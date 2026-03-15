/**
 * CORE-5: AI/BYOK Abstraction Engine
 * Blueprint Reference: Part 9.1 #7 (Vendor Neutral AI)
 * 
 * Implements a three-tier fallback mechanism:
 * 1. Tenant BYOK (Bring Your Own Key) via OpenRouter
 * 2. Platform Key via OpenRouter
 * 3. Cloudflare Workers AI (Fallback)
 */

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

export class AIEngine {
  private platformOpenRouterKey: string;
  private cloudflareAiBinding: any; // Type would be Ai from @cloudflare/workers-types

  constructor(platformOpenRouterKey: string, cloudflareAiBinding: any) {
    this.platformOpenRouterKey = platformOpenRouterKey;
    this.cloudflareAiBinding = cloudflareAiBinding;
  }

  /**
   * Executes an AI request using the three-tier fallback strategy.
   */
  async execute(request: AIRequest, tenantConfig: TenantConfig): Promise<AIResponse> {
    // Tier 1: Tenant BYOK via OpenRouter
    if (tenantConfig.openRouterKey) {
      try {
        return await this.callOpenRouter(
          request.prompt, 
          tenantConfig.openRouterKey, 
          request.model || tenantConfig.preferredModel || 'openai/gpt-4o-mini',
          'tenant-openrouter'
        );
      } catch (error) {
        console.warn(`Tenant BYOK failed for tenant ${request.tenantId}, falling back to platform key.`, error);
      }
    }

    // Tier 2: Platform Key via OpenRouter
    if (this.platformOpenRouterKey) {
      try {
        return await this.callOpenRouter(
          request.prompt, 
          this.platformOpenRouterKey, 
          request.model || 'openai/gpt-4o-mini',
          'platform-openrouter'
        );
      } catch (error) {
        console.warn(`Platform OpenRouter failed, falling back to Cloudflare AI.`, error);
      }
    }

    // Tier 3: Cloudflare Workers AI (Ultimate Fallback)
    return await this.callCloudflareAI(request.prompt);
  }

  private async callOpenRouter(prompt: string, apiKey: string, model: string, provider: 'tenant-openrouter' | 'platform-openrouter'): Promise<AIResponse> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://webwaka.com', // Required by OpenRouter
        'X-Title': 'WebWaka OS v4', // Required by OpenRouter
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    const data = await response.json() as any;
    return {
      text: data.choices[0].message.content,
      provider: provider,
      modelUsed: model
    };
  }

  private async callCloudflareAI(prompt: string): Promise<AIResponse> {
    if (!this.cloudflareAiBinding) {
      throw new Error('Cloudflare AI binding not configured');
    }

    const model = '@cf/meta/llama-3-8b-instruct';
    const response = await this.cloudflareAiBinding.run(model, {
      messages: [{ role: 'user', content: prompt }]
    });

    return {
      text: response.response,
      provider: 'cloudflare-ai',
      modelUsed: model
    };
  }
}
