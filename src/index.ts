/**
 * @webwaka/core — Main Entry Point
 * Blueprint Reference: Part 2 (Layer 4 — Tenant Resolution & Auth)
 *
 * Re-exports all platform primitives for consumers that import from '@webwaka/core'.
 * For tree-shaking, consumers can also import from sub-paths:
 *   import { verifyJWT } from '@webwaka/core/auth'
 *   import { requireRole } from '@webwaka/core/rbac'
 */

// ─── Auth (NEW — canonical, replaces all per-repo implementations) ────────────
export {
  signJWT,
  verifyJWT,
  jwtAuthMiddleware,
  requireRole,
  requirePermissions,
  secureCORS,
  rateLimit,
  getTenantId,
  getAuthUser,
  type JWTPayload,
  type AuthUser,
  type AuthEnv,
  type RateLimitEnv,
  type JwtAuthOptions,
  type SecureCORSOptions,
  type RateLimitOptions,
} from './core/auth/index.js';

// ─── Billing ──────────────────────────────────────────────────────────────────
export * from './core/billing/index.js';

// ─── Logger ───────────────────────────────────────────────────────────────────
export * from './core/logger/index.js';

// ─── Notifications ────────────────────────────────────────────────────────────
export * from './core/notifications/index.js';

// ─── AI Engine ────────────────────────────────────────────────────────────────
export * from './core/ai/AIEngine.js';

// ─── KYC ─────────────────────────────────────────────────────────────────────
export * from './core/kyc/index.js';

// ─── Geolocation ─────────────────────────────────────────────────────────────
export * from './core/geolocation/index.js';

// ─── Document ────────────────────────────────────────────────────────────────
export * from './core/document/index.js';

// ─── Chat ────────────────────────────────────────────────────────────────────
export * from './core/chat/index.js';

// ─── Booking ─────────────────────────────────────────────────────────────────
export * from './core/booking/index.js';

// ─── Event Bus ───────────────────────────────────────────────────────────────
export * from './core/event-bus/index.js';
