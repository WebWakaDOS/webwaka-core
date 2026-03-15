import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIEngine } from './AIEngine';

// Mock fetch for OpenRouter
global.fetch = vi.fn();

describe('CORE-5: AIEngine (Vendor Neutral AI)', () => {
  let aiEngine: AIEngine;
  let mockCloudflareAi: any;

  beforeEach(() => {
    vi.resetAllMocks();
    
    mockCloudflareAi = {
      run: vi.fn().mockResolvedValue({ response: 'Cloudflare AI response' })
    };
    
    aiEngine = new AIEngine('platform-key-123', mockCloudflareAi);
  });

  it('should use Tenant BYOK when provided (Tier 1)', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Tenant BYOK response' } }]
      })
    });

    const response = await aiEngine.execute(
      { prompt: 'Hello', tenantId: 'tenant-1' },
      { openRouterKey: 'tenant-key-456' }
    );

    expect(response.provider).toBe('tenant-openrouter');
    expect(response.text).toBe('Tenant BYOK response');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    
    // Verify the tenant key was used in the Authorization header
    const fetchArgs = (global.fetch as any).mock.calls[0];
    expect(fetchArgs[1].headers['Authorization']).toBe('Bearer tenant-key-456');
  });

  it('should fallback to Platform Key if Tenant BYOK fails (Tier 2)', async () => {
    // First call (Tenant) fails
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));
    
    // Second call (Platform) succeeds
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Platform key response' } }]
      })
    });

    const response = await aiEngine.execute(
      { prompt: 'Hello', tenantId: 'tenant-1' },
      { openRouterKey: 'tenant-key-456' }
    );

    expect(response.provider).toBe('platform-openrouter');
    expect(response.text).toBe('Platform key response');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    
    // Verify the platform key was used in the second call
    const secondFetchArgs = (global.fetch as any).mock.calls[1];
    expect(secondFetchArgs[1].headers['Authorization']).toBe('Bearer platform-key-123');
  });

  it('should fallback to Cloudflare AI if OpenRouter fails completely (Tier 3)', async () => {
    // Both OpenRouter calls fail
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    const response = await aiEngine.execute(
      { prompt: 'Hello', tenantId: 'tenant-1' },
      { openRouterKey: 'tenant-key-456' }
    );

    expect(response.provider).toBe('cloudflare-ai');
    expect(response.text).toBe('Cloudflare AI response');
    expect(mockCloudflareAi.run).toHaveBeenCalledTimes(1);
  });
});
