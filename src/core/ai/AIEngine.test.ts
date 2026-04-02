import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIEngine, generateCompletion, CF_DEFAULT_MODEL, CompletionConfig } from './AIEngine';
import { logger } from '../logger';

// Mock fetch for OpenRouter
global.fetch = vi.fn();

/**
 * Default engine uses maxRetries: 0 for the legacy three-tier fallback tests so
 * that the existing behavior (single attempt per tier, no retries) is preserved.
 * Retry-specific tests construct their own engine instances with maxRetries > 0.
 */
describe('CORE-5: AIEngine (Vendor Neutral AI)', () => {
  let aiEngine: AIEngine;
  let mockCloudflareAi: any;

  beforeEach(() => {
    vi.resetAllMocks();

    mockCloudflareAi = {
      run: vi.fn().mockResolvedValue({ response: 'Cloudflare AI response' }),
    };

    // maxRetries: 0 → single attempt per tier, matches the original test expectations.
    aiEngine = new AIEngine('platform-key-123', mockCloudflareAi, { maxRetries: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Original three-tier fallback tests (no retries) ──────────────────────

  it('should use Tenant BYOK when provided (Tier 1)', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Tenant BYOK response' } }],
      }),
    });

    const response = await aiEngine.execute(
      { prompt: 'Hello', tenantId: 'tenant-1' },
      { openRouterKey: 'tenant-key-456' }
    );

    expect(response.provider).toBe('tenant-openrouter');
    expect(response.text).toBe('Tenant BYOK response');
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const fetchArgs = (global.fetch as any).mock.calls[0];
    expect(fetchArgs[1].headers['Authorization']).toBe('Bearer tenant-key-456');
  });

  it('should fallback to Platform Key if Tenant BYOK fails (Tier 2)', async () => {
    // Tier 1 single attempt fails (maxRetries: 0)
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    // Tier 2 single attempt succeeds
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Platform key response' } }],
      }),
    });

    const response = await aiEngine.execute(
      { prompt: 'Hello', tenantId: 'tenant-1' },
      { openRouterKey: 'tenant-key-456' }
    );

    expect(response.provider).toBe('platform-openrouter');
    expect(response.text).toBe('Platform key response');
    expect(global.fetch).toHaveBeenCalledTimes(2);

    const secondFetchArgs = (global.fetch as any).mock.calls[1];
    expect(secondFetchArgs[1].headers['Authorization']).toBe('Bearer platform-key-123');
  });

  it('should fallback to Cloudflare AI if OpenRouter fails completely (Tier 3)', async () => {
    // All fetch calls fail (Tier 1 + Tier 2, each 1 attempt with maxRetries: 0)
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    const response = await aiEngine.execute(
      { prompt: 'Hello', tenantId: 'tenant-1' },
      { openRouterKey: 'tenant-key-456' }
    );

    expect(response.provider).toBe('cloudflare-ai');
    expect(response.text).toBe('Cloudflare AI response');
    expect(mockCloudflareAi.run).toHaveBeenCalledTimes(1);
  });

  // ─── Retry / backoff tests ─────────────────────────────────────────────────

  it('should retry within Tier 1 before succeeding (no tier escalation)', async () => {
    // Engine with default maxRetries: 2
    const retryEngine = new AIEngine('platform-key-123', mockCloudflareAi, {
      maxRetries: 2,
      backoffMs: 0, // zero delay for test speed
    });

    // Mock sleep to avoid real delays
    vi.spyOn(retryEngine as any, 'sleep').mockResolvedValue(undefined);

    // First two Tier 1 calls fail, third succeeds
    (global.fetch as any)
      .mockRejectedValueOnce(new Error('transient'))
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Retry success on Tier 1' } }],
        }),
      });

    const response = await retryEngine.execute(
      { prompt: 'Hello', tenantId: 'tenant-1' },
      { openRouterKey: 'tenant-key-456' }
    );

    expect(response.provider).toBe('tenant-openrouter');
    expect(response.text).toBe('Retry success on Tier 1');
    // 3 fetch calls — all on Tier 1, no escalation to Tier 2
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(mockCloudflareAi.run).not.toHaveBeenCalled();
  });

  it('should emit logger.warn for each retry attempt', async () => {
    const retryEngine = new AIEngine('platform-key-123', mockCloudflareAi, {
      maxRetries: 2,
      backoffMs: 0,
    });

    vi.spyOn(retryEngine as any, 'sleep').mockResolvedValue(undefined);
    const warnSpy = vi.spyOn(logger, 'warn');

    // All Tier 1 attempts fail, Tier 2 first attempt succeeds
    (global.fetch as any)
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Platform response' } }],
        }),
      });

    const response = await retryEngine.execute(
      { prompt: 'Test', tenantId: 'tenant-warn' },
      { openRouterKey: 'tenant-key' }
    );

    expect(response.provider).toBe('platform-openrouter');
    // logger.warn should have been called for retries + exhaustion
    expect(warnSpy).toHaveBeenCalled();
    const warnMessages = warnSpy.mock.calls.map(c => c[0]);
    expect(warnMessages.some(m => m.includes('retry') || m.includes('exhausted'))).toBe(true);
  });

  it('should call sleep with exponential backoff delays between retries', async () => {
    const retryEngine = new AIEngine('platform-key-123', mockCloudflareAi, {
      maxRetries: 2,
      backoffMs: 100,
    });

    const sleepSpy = vi.spyOn(retryEngine as any, 'sleep').mockResolvedValue(undefined);

    // All Tier 1 attempts fail, Tier 2 succeeds immediately
    (global.fetch as any)
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'ok' } }],
        }),
      });

    await retryEngine.execute(
      { prompt: 'Test', tenantId: 't1' },
      { openRouterKey: 'key' }
    );

    // Retries 1 and 2 within Tier 1: delays = 100*2^0=100ms, 100*2^1=200ms
    const sleepCalls = sleepSpy.mock.calls.map(c => c[0]);
    expect(sleepCalls).toContain(100);
    expect(sleepCalls).toContain(200);
  });

  it('should retry within Tier 1, exhaust, then fall to Tier 2 and succeed', async () => {
    const retryEngine = new AIEngine('platform-key-123', mockCloudflareAi, {
      maxRetries: 1,
      backoffMs: 0,
    });

    vi.spyOn(retryEngine as any, 'sleep').mockResolvedValue(undefined);

    // Tier 1: 2 attempts (initial + 1 retry), both fail
    // Tier 2: 1 attempt, succeeds
    (global.fetch as any)
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Tier 2 after Tier 1 exhaustion' } }],
        }),
      });

    const response = await retryEngine.execute(
      { prompt: 'Hello', tenantId: 'tenant-1' },
      { openRouterKey: 'tenant-key' }
    );

    expect(response.provider).toBe('platform-openrouter');
    expect(response.text).toBe('Tier 2 after Tier 1 exhaustion');
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('should throw (and trigger retry/fallback) when OpenRouter returns malformed payload', async () => {
    // Engine with maxRetries: 0 so it escalates immediately after one bad response
    // Tier 1: returns HTTP 200 but with missing choices structure → should throw → fallback
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: 'unexpected shape' }), // no choices array
    });

    // Tier 2: also returns malformed payload → throws → escalates to Tier 3
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}), // completely empty
    });

    // Tier 3 CF AI succeeds
    const response = await aiEngine.execute(
      { prompt: 'Hello', tenantId: 'tenant-1' },
      { openRouterKey: 'tenant-key-456' }
    );

    expect(response.provider).toBe('cloudflare-ai');
    expect(mockCloudflareAi.run).toHaveBeenCalledTimes(1);
  });

  it('should retry Tier 1 on malformed payload before escalating (maxRetries: 1)', async () => {
    const retryEngine = new AIEngine('platform-key-123', mockCloudflareAi, {
      maxRetries: 1,
      backoffMs: 0,
    });
    vi.spyOn(retryEngine as any, 'sleep').mockResolvedValue(undefined);

    // Tier 1: attempt 1 → malformed, attempt 2 (retry) → valid
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bad: 'payload' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Recovered after retry' } }],
        }),
      });

    const response = await retryEngine.execute(
      { prompt: 'Hello', tenantId: 'tenant-1' },
      { openRouterKey: 'tenant-key-456' }
    );

    expect(response.provider).toBe('tenant-openrouter');
    expect(response.text).toBe('Recovered after retry');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  // ─── executeStream tests ───────────────────────────────────────────────────

  it('should return a ReadableStream from executeStream (Tier 1 success)', async () => {
    const mockBody = new ReadableStream<Uint8Array>();

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      body: mockBody,
    });

    const stream = await aiEngine.executeStream(
      { prompt: 'Stream test', tenantId: 'tenant-1' },
      { openRouterKey: 'tenant-key-456' }
    );

    expect(stream).toBeInstanceOf(ReadableStream);
    expect(stream).toBe(mockBody);
  });

  it('should include stream: true in the OpenRouter request body for executeStream', async () => {
    const mockBody = new ReadableStream<Uint8Array>();

    (global.fetch as any).mockResolvedValueOnce({ ok: true, body: mockBody });

    await aiEngine.executeStream(
      { prompt: 'Stream test', tenantId: 'tenant-1' },
      { openRouterKey: 'tenant-key-456' }
    );

    const fetchCall = (global.fetch as any).mock.calls[0];
    const bodyObj = JSON.parse(fetchCall[1].body);
    expect(bodyObj.stream).toBe(true);
  });

  it('should fall back to Tier 2 stream if Tier 1 executeStream fails', async () => {
    // maxRetries: 0 → single attempt per tier
    const mockBody = new ReadableStream<Uint8Array>();

    // Tier 1 fails
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));
    // Tier 2 succeeds with streaming body
    (global.fetch as any).mockResolvedValueOnce({ ok: true, body: mockBody });

    const stream = await aiEngine.executeStream(
      { prompt: 'Stream test', tenantId: 'tenant-1' },
      { openRouterKey: 'tenant-key-456' }
    );

    expect(stream).toBeInstanceOf(ReadableStream);
    expect(stream).toBe(mockBody);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should exhaust Tier 1 stream retries before falling to Tier 2 stream (maxRetries: 1)', async () => {
    const retryEngine = new AIEngine('platform-key-123', mockCloudflareAi, {
      maxRetries: 1,
      backoffMs: 0,
    });
    vi.spyOn(retryEngine as any, 'sleep').mockResolvedValue(undefined);

    const mockBody = new ReadableStream<Uint8Array>();

    // Tier 1: 2 attempts (initial + 1 retry), both fail
    (global.fetch as any)
      .mockRejectedValueOnce(new Error('stream fail'))
      .mockRejectedValueOnce(new Error('stream fail'))
      // Tier 2: succeeds
      .mockResolvedValueOnce({ ok: true, body: mockBody });

    const stream = await retryEngine.executeStream(
      { prompt: 'Hello', tenantId: 'tenant-1' },
      { openRouterKey: 'tenant-key' }
    );

    expect(stream).toBeInstanceOf(ReadableStream);
    expect(stream).toBe(mockBody);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('should fall back to Cloudflare AI single-chunk stream if all OpenRouter stream attempts fail', async () => {
    // maxRetries: 0 → both Tier 1 and Tier 2 fail on first attempt
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    const stream = await aiEngine.executeStream(
      { prompt: 'Stream test', tenantId: 'tenant-1' },
      { openRouterKey: 'tenant-key-456' }
    );

    expect(stream).toBeInstanceOf(ReadableStream);
    expect(mockCloudflareAi.run).toHaveBeenCalledTimes(1);

    // Read the single chunk and verify it contains the CF AI response text
    const reader = stream.getReader();
    const { value, done } = await reader.read();
    expect(done).toBe(false);
    expect(value).toBeInstanceOf(Uint8Array);
    const text = new TextDecoder().decode(value);
    expect(text).toBe('Cloudflare AI response');
  });

  it('should respect configurable maxRetries and backoffMs via constructor options', () => {
    const customEngine = new AIEngine('key', mockCloudflareAi, {
      maxRetries: 5,
      backoffMs: 50,
    });
    // Access private fields via cast to validate constructor wiring
    expect((customEngine as any).maxRetries).toBe(5);
    expect((customEngine as any).backoffMs).toBe(50);
  });
});

// ─── T-FND-06: generateCompletion — standalone vendor-neutral function ─────────

describe('T-FND-06: generateCompletion — OpenRouter primary, Cloudflare AI fallback', () => {
  let mockCfAi: any;

  const baseConfig: CompletionConfig = {
    openRouterApiKey: 'or-kv-key-from-tenant',
    cfAiBinding: undefined, // overridden per test
  };

  function makeOpenRouterSuccess(content: string, model = 'openai/gpt-4o-mini') {
    return {
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        choices: [{ message: { content } }],
        model,
      }),
    };
  }

  function makeOpenRouterError(status = 500) {
    return {
      ok: false,
      status,
      json: () => Promise.resolve({ error: { message: 'Internal Server Error' } }),
    };
  }

  beforeEach(() => {
    vi.resetAllMocks();
    mockCfAi = {
      run: vi.fn().mockResolvedValue({ response: 'Llama fallback response' }),
    };
  });

  // ── OpenRouter success path ─────────────────────────────────────────────

  it('returns text from OpenRouter on success with provider=openrouter', async () => {
    (global.fetch as any).mockResolvedValueOnce(makeOpenRouterSuccess('Hello from OpenRouter'));

    const result = await generateCompletion('Say hello', {
      ...baseConfig,
      cfAiBinding: mockCfAi,
    });

    expect(result.text).toBe('Hello from OpenRouter');
    expect(result.provider).toBe('openrouter');
    expect(result.modelUsed).toBe('openai/gpt-4o-mini');
    expect(result.timedOut).toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(mockCfAi.run).not.toHaveBeenCalled();
  });

  it('sends the correct OpenRouter request — Authorization, headers, model, messages', async () => {
    (global.fetch as any).mockResolvedValueOnce(makeOpenRouterSuccess('ok'));

    await generateCompletion('Test prompt', {
      openRouterApiKey: 'or-kv-key-from-tenant',
      cfAiBinding: mockCfAi,
      model: 'anthropic/claude-3-haiku',
    });

    const [url, init] = (global.fetch as any).mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.headers['Authorization']).toBe('Bearer or-kv-key-from-tenant');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['HTTP-Referer']).toBe('https://webwaka.com');

    const body = JSON.parse(init.body);
    expect(body.model).toBe('anthropic/claude-3-haiku');
    expect(body.messages).toEqual([{ role: 'user', content: 'Test prompt' }]);
  });

  it('uses openai/gpt-4o-mini as the default OpenRouter model', async () => {
    (global.fetch as any).mockResolvedValueOnce(makeOpenRouterSuccess('Default model response'));

    const result = await generateCompletion('Hello', {
      openRouterApiKey: 'or-key',
      cfAiBinding: mockCfAi,
    });

    const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(body.model).toBe('openai/gpt-4o-mini');
    expect(result.modelUsed).toBe('openai/gpt-4o-mini');
  });

  it('passes an AbortSignal to fetch (timeout enforcement)', async () => {
    (global.fetch as any).mockResolvedValueOnce(makeOpenRouterSuccess('ok'));

    await generateCompletion('Test', {
      openRouterApiKey: 'or-key',
      cfAiBinding: mockCfAi,
      timeoutMs: 5000,
    });

    const [, init] = (global.fetch as any).mock.calls[0];
    expect(init.signal).toBeDefined();
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  // ── OpenRouter HTTP error → CF AI fallback ─────────────────────────────

  it('falls back to Cloudflare AI when OpenRouter returns a non-OK HTTP status', async () => {
    (global.fetch as any).mockResolvedValueOnce(makeOpenRouterError(503));

    const result = await generateCompletion('Hello', {
      openRouterApiKey: 'or-key',
      cfAiBinding: mockCfAi,
    });

    expect(result.text).toBe('Llama fallback response');
    expect(result.provider).toBe('cloudflare-ai');
    expect(result.modelUsed).toBe(CF_DEFAULT_MODEL);
    expect(result.timedOut).toBeUndefined();
    expect(mockCfAi.run).toHaveBeenCalledTimes(1);
    expect(mockCfAi.run).toHaveBeenCalledWith(CF_DEFAULT_MODEL, {
      messages: [{ role: 'user', content: 'Hello' }],
    });
  });

  it('falls back to Cloudflare AI when OpenRouter returns malformed response structure', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ result: 'unexpected shape' }),
    });

    const result = await generateCompletion('Hello', {
      openRouterApiKey: 'or-key',
      cfAiBinding: mockCfAi,
    });

    expect(result.provider).toBe('cloudflare-ai');
    expect(result.text).toBe('Llama fallback response');
  });

  // ── OpenRouter network error → CF AI fallback ──────────────────────────

  it('falls back to Cloudflare AI when OpenRouter fetch throws a network error', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await generateCompletion('Hello', {
      openRouterApiKey: 'or-key',
      cfAiBinding: mockCfAi,
    });

    expect(result.text).toBe('Llama fallback response');
    expect(result.provider).toBe('cloudflare-ai');
    expect(result.timedOut).toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(mockCfAi.run).toHaveBeenCalledTimes(1);
  });

  // ── OpenRouter timeout (AbortError) → CF AI fallback with timedOut: true

  it('falls back to CF AI with timedOut=true when fetch throws an AbortError', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    (global.fetch as any).mockRejectedValueOnce(abortError);

    const result = await generateCompletion('Hello', {
      openRouterApiKey: 'or-key',
      cfAiBinding: mockCfAi,
      timeoutMs: 100,
    });

    expect(result.provider).toBe('cloudflare-ai');
    expect(result.text).toBe('Llama fallback response');
    expect(result.timedOut).toBe(true);
  });

  it('falls back to CF AI with timedOut=true when fetch throws a TimeoutError', async () => {
    const timeoutError = new Error('The request timed out');
    timeoutError.name = 'TimeoutError';
    (global.fetch as any).mockRejectedValueOnce(timeoutError);

    const result = await generateCompletion('Hello', {
      openRouterApiKey: 'or-key',
      cfAiBinding: mockCfAi,
    });

    expect(result.provider).toBe('cloudflare-ai');
    expect(result.timedOut).toBe(true);
  });

  it('does NOT set timedOut when fallback is triggered by an HTTP error (not a timeout)', async () => {
    (global.fetch as any).mockResolvedValueOnce(makeOpenRouterError(429));

    const result = await generateCompletion('Hello', {
      openRouterApiKey: 'or-key',
      cfAiBinding: mockCfAi,
    });

    expect(result.provider).toBe('cloudflare-ai');
    expect(result.timedOut).toBeUndefined();
  });

  // ── Custom fallback model ───────────────────────────────────────────────

  it('uses the custom fallbackModel when CF AI fallback is triggered', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('OpenRouter down'));

    const customCfAi = {
      run: vi.fn().mockResolvedValue({ response: 'Custom model response' }),
    };

    const result = await generateCompletion('Hello', {
      openRouterApiKey: 'or-key',
      cfAiBinding: customCfAi,
      fallbackModel: '@cf/meta/llama-3.1-8b-instruct',
    });

    expect(result.modelUsed).toBe('@cf/meta/llama-3.1-8b-instruct');
    expect(customCfAi.run).toHaveBeenCalledWith(
      '@cf/meta/llama-3.1-8b-instruct',
      { messages: [{ role: 'user', content: 'Hello' }] }
    );
    expect(result.text).toBe('Custom model response');
  });

  // ── Missing CF AI binding ───────────────────────────────────────────────

  it('throws explicitly when OpenRouter fails and no cfAiBinding is provided', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    await expect(
      generateCompletion('Hello', { openRouterApiKey: 'or-key' })
    ).rejects.toThrow('no Cloudflare AI binding was provided');
  });

  it('throws when OpenRouter times out and no cfAiBinding is provided', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    (global.fetch as any).mockRejectedValueOnce(abortError);

    await expect(
      generateCompletion('Hello', { openRouterApiKey: 'or-key' })
    ).rejects.toThrow('no Cloudflare AI binding was provided');
  });

  // ── CF_DEFAULT_MODEL export ─────────────────────────────────────────────

  it('CF_DEFAULT_MODEL is the expected Llama 3 instruct model', () => {
    expect(CF_DEFAULT_MODEL).toBe('@cf/meta/llama-3-8b-instruct');
  });
});
