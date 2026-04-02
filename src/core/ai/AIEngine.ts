/**
 * CORE-5: AI/BYOK Abstraction Engine
 * Blueprint Reference: Part 9.1 #7 (Vendor Neutral AI)
 *
 * Implements a three-tier fallback mechanism with per-tier retry and exponential backoff:
 *   1. Tenant BYOK (Bring Your Own Key) via OpenRouter
 *   2. Platform Key via OpenRouter
 *   3. Cloudflare Workers AI (Ultimate Fallback)
 *
 * Each tier is retried up to `maxRetries` times (default 2) before escalating.
 * Between attempts the engine sleeps for backoffMs * 2^attempt milliseconds.
 *
 * T-FND-06: Also exports `generateCompletion` — a standalone, vendor-neutral function
 * that routes through OpenRouter and falls back to Cloudflare Workers AI
 * (`@cf/meta/llama-3-8b-instruct`) on timeout or error.
 */

import { logger } from '../logger/index.js';

// ─── Shared Constants ─────────────────────────────────────────────────────────

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/** Default Cloudflare Workers AI model used as the ultimate fallback. */
export const CF_DEFAULT_MODEL = '@cf/meta/llama-3-8b-instruct';

export interface AIRequest {
  prompt: string;
  model?: string;
  tenantId: string;
}

export interface AIResponse {
  text: string;
  provider: 'tenant-openrouter' | 'platform-openrouter' | 'cloudflare-ai';
  modelUsed: string;
}

export interface TenantConfig {
  openRouterKey?: string;
  preferredModel?: string;
}

export interface AIEngineOptions {
  /** Maximum number of retry attempts per tier before escalating. Default: 2 */
  maxRetries?: number;
  /** Base delay in milliseconds for exponential backoff. Default: 200 */
  backoffMs?: number;
}

export class AIEngine {
  private platformOpenRouterKey: string;
  private cloudflareAiBinding: any; // Type would be Ai from @cloudflare/workers-types
  private maxRetries: number;
  private backoffMs: number;

  constructor(
    platformOpenRouterKey: string,
    cloudflareAiBinding: any,
    options: AIEngineOptions = {}
  ) {
    this.platformOpenRouterKey = platformOpenRouterKey;
    this.cloudflareAiBinding = cloudflareAiBinding;
    this.maxRetries = options.maxRetries ?? 2;
    this.backoffMs = options.backoffMs ?? 200;
  }

  /**
   * Executes an AI request using the three-tier fallback strategy.
   * Each tier is retried up to `maxRetries` times with exponential backoff
   * before escalating to the next tier.
   */
  async execute(request: AIRequest, tenantConfig: TenantConfig): Promise<AIResponse> {
    // Tier 1: Tenant BYOK via OpenRouter
    if (tenantConfig.openRouterKey) {
      const tier1Result = await this.withRetry(
        'Tier 1 (tenant BYOK)',
        request.tenantId,
        () => this.callOpenRouter(
          request.prompt,
          tenantConfig.openRouterKey!,
          request.model ?? tenantConfig.preferredModel ?? 'openai/gpt-4o-mini',
          'tenant-openrouter'
        )
      );
      if (tier1Result !== null) return tier1Result;
    }

    // Tier 2: Platform Key via OpenRouter
    if (this.platformOpenRouterKey) {
      const tier2Result = await this.withRetry(
        'Tier 2 (platform key)',
        request.tenantId,
        () => this.callOpenRouter(
          request.prompt,
          this.platformOpenRouterKey,
          request.model ?? 'openai/gpt-4o-mini',
          'platform-openrouter'
        )
      );
      if (tier2Result !== null) return tier2Result;
    }

    // Tier 3: Cloudflare Workers AI (Ultimate Fallback — no retry needed, CF AI is durable)
    return await this.callCloudflareAI(request.prompt);
  }

  /**
   * Executes an AI request and returns a ReadableStream<Uint8Array> for
   * server-sent events streaming.
   *
   * - Tier 1 & 2: calls OpenRouter with `stream: true` and pipes `Response.body`.
   * - Tier 3 (CF AI fallback): calls `execute()` and wraps the text in a
   *   single-chunk ReadableStream (CF AI does not support streaming natively).
   */
  async executeStream(
    request: AIRequest,
    tenantConfig: TenantConfig
  ): Promise<ReadableStream<Uint8Array>> {
    // Tier 1: Tenant BYOK streaming
    if (tenantConfig.openRouterKey) {
      const tier1Result = await this.withRetry(
        'Tier 1 stream (tenant BYOK)',
        request.tenantId,
        () => this.callOpenRouterStream(
          request.prompt,
          tenantConfig.openRouterKey!,
          request.model ?? tenantConfig.preferredModel ?? 'openai/gpt-4o-mini'
        )
      );
      if (tier1Result !== null) return tier1Result;
    }

    // Tier 2: Platform Key streaming
    if (this.platformOpenRouterKey) {
      const tier2Result = await this.withRetry(
        'Tier 2 stream (platform key)',
        request.tenantId,
        () => this.callOpenRouterStream(
          request.prompt,
          this.platformOpenRouterKey,
          request.model ?? 'openai/gpt-4o-mini'
        )
      );
      if (tier2Result !== null) return tier2Result;
    }

    // Tier 3: Cloudflare AI — wrap non-streaming execute() result in a single-chunk stream
    // (CF AI does not support native streaming; this keeps fallback logic in one place)
    const fallback = await this.execute(request, tenantConfig);
    const encoder = new TextEncoder();
    const chunk = encoder.encode(fallback.text);
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk);
        controller.close();
      },
    });
  }

  /**
   * Runs `fn` up to `maxRetries + 1` times (1 initial attempt + maxRetries retries).
   * Emits logger.warn on each retry. Returns the result on success, or null after
   * exhausting all attempts (so the caller can escalate to the next tier).
   */
  private async withRetry<T>(
    tierLabel: string,
    tenantId: string,
    fn: () => Promise<T>
  ): Promise<T | null> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const delayMs = this.backoffMs * Math.pow(2, attempt - 1);
        logger.warn(`${tierLabel} retry attempt ${attempt} after ${delayMs}ms`, {
          tenantId,
          attempt,
          delayMs,
        });
        await this.sleep(delayMs);
      }

      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt < this.maxRetries) {
          logger.warn(`${tierLabel} attempt ${attempt + 1} failed, will retry`, {
            tenantId,
            attempt: attempt + 1,
            error,
          });
        }
      }
    }

    logger.warn(`${tierLabel} exhausted all ${this.maxRetries + 1} attempts, escalating`, {
      tenantId,
      error: lastError,
    });
    return null;
  }

  /**
   * Delays execution for `ms` milliseconds.
   * Defined as a protected method so tests can spy on it via vi.spyOn(engine, 'sleep').
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async callOpenRouter(
    prompt: string,
    apiKey: string,
    model: string,
    provider: 'tenant-openrouter' | 'platform-openrouter'
  ): Promise<AIResponse> {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://webwaka.com',
        'X-Title': 'WebWaka OS v4',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    const data = await response.json() as any;
    const content: string | undefined = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error('OpenRouter returned an unexpected response structure (missing choices[0].message.content)');
    }
    return { text: content, provider, modelUsed: model };
  }

  private async callOpenRouterStream(
    prompt: string,
    apiKey: string,
    model: string
  ): Promise<ReadableStream<Uint8Array>> {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://webwaka.com',
        'X-Title': 'WebWaka OS v4',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter streaming API error: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('OpenRouter returned no response body for streaming request');
    }

    return response.body;
  }

  private async callCloudflareAI(prompt: string): Promise<AIResponse> {
    if (!this.cloudflareAiBinding) {
      throw new Error('Cloudflare AI binding not configured');
    }

    const model = CF_DEFAULT_MODEL;
    const response = await this.cloudflareAiBinding.run(model, {
      messages: [{ role: 'user', content: prompt }],
    });

    return {
      text: response.response,
      provider: 'cloudflare-ai',
      modelUsed: model,
    };
  }
}

// ─── T-FND-06: generateCompletion — standalone vendor-neutral function ─────────

/**
 * Configuration for `generateCompletion`.
 * All keys must be sourced from KV or environment bindings — never hardcoded.
 */
export interface CompletionConfig {
  /**
   * OpenRouter API key. Sourced from tenant KV or platform env — never hardcoded.
   * Used as the primary delivery path (Vendor Neutral AI invariant).
   */
  openRouterApiKey: string;
  /**
   * Cloudflare Workers AI binding (`env.AI`).
   * Required for the `@cf/meta/llama-3-8b-instruct` fallback tier.
   * If omitted and OpenRouter fails, `generateCompletion` throws.
   */
  cfAiBinding?: any;
  /** OpenRouter model to use. Defaults to `openai/gpt-4o-mini`. */
  model?: string;
  /**
   * Cloudflare Workers AI model for the fallback tier.
   * Defaults to `@cf/meta/llama-3-8b-instruct`.
   */
  fallbackModel?: string;
  /** OpenRouter request timeout in milliseconds. Defaults to 10 000 ms. */
  timeoutMs?: number;
}

/** Result returned by `generateCompletion`. */
export interface CompletionResult {
  /** The generated text content. */
  text: string;
  /** Which provider actually served the response. */
  provider: 'openrouter' | 'cloudflare-ai';
  /** The exact model identifier used. */
  modelUsed: string;
  /**
   * Present and `true` only when OpenRouter was abandoned due to a timeout
   * and the Cloudflare AI fallback was used instead.
   */
  timedOut?: true;
}

/**
 * T-FND-06: Vendor-neutral AI completion with automatic Cloudflare AI fallback.
 *
 * Routing strategy:
 *   1. Call OpenRouter with the configured `openRouterApiKey` and a timeout.
 *   2. If OpenRouter times out (AbortError / TimeoutError) or returns an error,
 *      fall back to Cloudflare Workers AI (`@cf/meta/llama-3-8b-instruct` by default).
 *   3. If `cfAiBinding` is not provided and OpenRouter fails, throw explicitly.
 *
 * When the fallback is triggered by a timeout, `result.timedOut === true` so
 * callers can log or instrument the latency degradation.
 *
 * @param prompt  - The user prompt to complete.
 * @param config  - Routing config. API keys must come from KV — never hardcoded.
 */
export async function generateCompletion(
  prompt: string,
  config: CompletionConfig
): Promise<CompletionResult> {
  const model = config.model ?? 'openai/gpt-4o-mini';
  const timeoutMs = config.timeoutMs ?? 10_000;
  let openRouterTimedOut = false;

  // ── Primary: OpenRouter ───────────────────────────────────────────────────
  try {
    const signal = AbortSignal.timeout(timeoutMs);

    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://webwaka.com',
        'X-Title': 'WebWaka OS v4',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal,
    });

    if (!res.ok) {
      throw new Error(`OpenRouter error: HTTP ${res.status}`);
    }

    const data = await res.json() as any;
    const text: string | undefined = data?.choices?.[0]?.message?.content;

    if (typeof text !== 'string') {
      throw new Error('OpenRouter returned unexpected response structure');
    }

    logger.info('generateCompletion: OpenRouter success', { model });
    return { text, provider: 'openrouter', modelUsed: model };
  } catch (err: any) {
    if (err?.name === 'AbortError' || err?.name === 'TimeoutError') {
      openRouterTimedOut = true;
      logger.warn('generateCompletion: OpenRouter timed out — triggering Cloudflare AI fallback', {
        model,
        timeoutMs,
      });
    } else {
      logger.warn('generateCompletion: OpenRouter failed — triggering Cloudflare AI fallback', {
        model,
        error: err?.message,
      });
    }
  }

  // ── Fallback: Cloudflare Workers AI ──────────────────────────────────────
  if (!config.cfAiBinding) {
    throw new Error(
      'generateCompletion: OpenRouter failed and no Cloudflare AI binding was provided'
    );
  }

  const fallbackModel = config.fallbackModel ?? CF_DEFAULT_MODEL;

  const cfResponse = await config.cfAiBinding.run(fallbackModel, {
    messages: [{ role: 'user', content: prompt }],
  });

  logger.info('generateCompletion: Cloudflare AI fallback success', { fallbackModel });

  return {
    text: cfResponse.response,
    provider: 'cloudflare-ai',
    modelUsed: fallbackModel,
    ...(openRouterTimedOut ? { timedOut: true as const } : {}),
  };
}
