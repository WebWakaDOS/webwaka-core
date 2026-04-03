/**
 * Barrel export coverage test — src/index.ts
 *
 * This file imports from the main entry point to ensure the barrel is
 * exercised by the coverage tool. All actual logic is tested in the
 * individual module test files.
 */
import { describe, it, expect } from 'vitest';
import {
  // Auth
  signJWT,
  verifyJWT,
  jwtAuthMiddleware,
  verifyApiKey,
  requireRole,
  requirePermissions,
  secureCORS,
  rateLimit,
  getTenantId,
  getAuthUser,
  // Tax
  TaxEngine,
  createTaxEngine,
  // Payment
  PaystackProvider,
  createPaymentProvider,
  // SMS
  TermiiProvider,
  createSmsProvider,
  sendTermiiSms,
  // Rate limit (KV standalone)
  checkRateLimit,
  // Optimistic lock
  updateWithVersionLock,
  // PIN
  hashPin,
  verifyPin,
  // AI (OpenRouterClient — src/ai.ts)
  OpenRouterClient,
  createAiClient,
  // AI Engine + generateCompletion (src/core/ai/AIEngine.ts)
  AIEngine,
  generateCompletion,
  CF_DEFAULT_MODEL,
  // Events
  CommerceEvents,
  // Nanoid
  nanoid,
  genId,
  // Query helpers
  parsePagination,
  metaResponse,
  applyTenantScope,
  // NDPR
  assertNdprConsent,
  recordNdprConsent,
  // CORE-10: UI Branding Schema
  brandingKvKey,
  DEFAULT_BRANDING,
  // CORE-9: Canonical Event Types
  WebWakaEventType,
  createEvent,
} from './index';

describe('@webwaka/core barrel exports', () => {
  it('exports auth functions', () => {
    expect(typeof signJWT).toBe('function');
    expect(typeof verifyJWT).toBe('function');
    expect(typeof jwtAuthMiddleware).toBe('function');
    expect(typeof verifyApiKey).toBe('function');
    expect(typeof requireRole).toBe('function');
    expect(typeof requirePermissions).toBe('function');
    expect(typeof secureCORS).toBe('function');
    expect(typeof rateLimit).toBe('function');
    expect(typeof getTenantId).toBe('function');
    expect(typeof getAuthUser).toBe('function');
  });

  it('exports tax utilities', () => {
    expect(typeof TaxEngine).toBe('function');
    expect(typeof createTaxEngine).toBe('function');
  });

  it('exports payment utilities', () => {
    expect(typeof PaystackProvider).toBe('function');
    expect(typeof createPaymentProvider).toBe('function');
  });

  it('exports SMS utilities', () => {
    expect(typeof TermiiProvider).toBe('function');
    expect(typeof createSmsProvider).toBe('function');
    expect(typeof sendTermiiSms).toBe('function');
  });

  it('exports rate limit utility', () => {
    expect(typeof checkRateLimit).toBe('function');
  });

  it('exports optimistic lock utility', () => {
    expect(typeof updateWithVersionLock).toBe('function');
  });

  it('exports PIN utilities', () => {
    expect(typeof hashPin).toBe('function');
    expect(typeof verifyPin).toBe('function');
  });

  it('exports AI client', () => {
    expect(typeof OpenRouterClient).toBe('function');
    expect(typeof createAiClient).toBe('function');
  });

  it('exports AIEngine, generateCompletion, and CF_DEFAULT_MODEL (T-FND-06)', () => {
    expect(typeof AIEngine).toBe('function');
    expect(typeof generateCompletion).toBe('function');
    expect(CF_DEFAULT_MODEL).toBe('@cf/meta/llama-3-8b-instruct');
  });

  it('exports CommerceEvents', () => {
    expect(CommerceEvents).toBeDefined();
    expect(CommerceEvents.ORDER_CREATED).toBe('order.created');
  });

  it('exports nanoid utilities', () => {
    expect(typeof nanoid).toBe('function');
    expect(typeof genId).toBe('function');
  });

  it('exports query helpers', () => {
    expect(typeof parsePagination).toBe('function');
    expect(typeof metaResponse).toBe('function');
    expect(typeof applyTenantScope).toBe('function');
  });

  it('exports NDPR utilities', () => {
    expect(typeof assertNdprConsent).toBe('function');
    expect(typeof recordNdprConsent).toBe('function');
  });

  // ─── CORE-10: TenantBrandingSchema (ISSUE-3 fix) ─────────────────────────
  it('exports branding utilities (CORE-10)', () => {
    expect(typeof brandingKvKey).toBe('function');
    expect(brandingKvKey('tenant_123')).toBe('branding:tenant_123');
    expect(DEFAULT_BRANDING).toBeDefined();
    expect(DEFAULT_BRANDING.colors.primary).toBe('#2563EB');
    expect(DEFAULT_BRANDING.typography.headingFont).toBe('Inter');
    expect(DEFAULT_BRANDING.layout.navigationStyle).toBe('top-bar');
  });

  // ─── CORE-9: Canonical Event Types (ISSUE-3 fix) ─────────────────────────
  it('exports WebWakaEventType with UI and AI event types (CORE-9)', () => {
    expect(WebWakaEventType.UI_TEMPLATE_CREATED).toBe('ui.template.created');
    expect(WebWakaEventType.UI_TEMPLATE_UPDATED).toBe('ui.template.updated');
    expect(WebWakaEventType.UI_DEPLOYMENT_REQUESTED).toBe('ui.deployment.requested');
    expect(WebWakaEventType.UI_DEPLOYMENT_STARTED).toBe('ui.deployment.started');
    expect(WebWakaEventType.UI_DEPLOYMENT_SUCCESS).toBe('ui.deployment.success');
    expect(WebWakaEventType.UI_DEPLOYMENT_FAILED).toBe('ui.deployment.failed');
    expect(WebWakaEventType.UI_BRANDING_UPDATED).toBe('ui.branding.updated');
    expect(WebWakaEventType.AI_CAPABILITY_ENABLED).toBe('ai.capability.enabled');
    expect(WebWakaEventType.AI_CAPABILITY_DISABLED).toBe('ai.capability.disabled');
    expect(WebWakaEventType.AI_USAGE_RECORDED).toBe('ai.usage.recorded');
    expect(WebWakaEventType.AI_BYOK_KEY_ADDED).toBe('ai.byok.key.added');
    expect(WebWakaEventType.AI_BYOK_KEY_REMOVED).toBe('ai.byok.key.removed');
  });

  it('exports createEvent factory (CORE-9)', () => {
    expect(typeof createEvent).toBe('function');
    const event = createEvent(WebWakaEventType.AI_USAGE_RECORDED, 'tenant_test', {
      tenantId: 'tenant_test',
      capabilityId: 'text-generation',
      model: 'gpt-4o-mini',
      inputTokens: 100,
      outputTokens: 50,
      totalCostKobo: 250,
      byok: false,
    });
    expect(event.type).toBe('ai.usage.recorded');
    expect(event.tenantId).toBe('tenant_test');
    expect(event.id).toBeTruthy();
  });
});
