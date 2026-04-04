# WEBWAKA-CORE DEEP RESEARCH + ENHANCEMENT TASKBOOK

**Repo:** `@webwaka/core` — `https://github.com/WebWakaDOS/webwaka-core`
**Version at Analysis:** 1.5.0
**Analysis Date:** April 2026
**Author:** Replit Expert Research Agent
**Classification:** Internal Engineering Document — Governance Tier 1

---

## TABLE OF CONTENTS

1. Repo Deep Understanding
2. External Best-Practice Research Summary
3. Synthesis and Gap Analysis
4. Top 20 Enhancements
5. Bug Fix Recommendations
6. Task Breakdown (Tasks T001–T025)
7. QA Plans (One per Task)
8. Implementation Prompts (One per Task)
9. QA Prompts (One per Task)
10. Priority Order
11. Dependency Map
12. Phase 1 / Phase 2 Split
13. Repo Context and Ecosystem Notes
14. Governance and Reminder Block
15. Execution Readiness Notes

---

## SECTION 1 — REPO DEEP UNDERSTANDING

### 1.1 Repository Identity

| Field | Value |
|---|---|
| Package Name | `@webwaka/core` |
| NPM Scope | `@webwaka` |
| Current Version | `1.5.0` |
| License | UNLICENSED (proprietary) |
| Language | TypeScript 5.x |
| Runtime Target | Cloudflare Workers (edge, not Node.js) |
| Module System | ESM only (`"type": "module"`) |
| Framework | Hono ≥4.0.0 (peer dependency) |
| Package Manager | pnpm |
| Build Tool | `tsc` |
| Test Runner | Vitest (v8 coverage) |
| CI/CD | GitHub Actions (test + publish to npm on `main` push) |

### 1.2 Architectural Position in WebWaka Ecosystem

`@webwaka/core` is the **foundational platform primitive layer** for the entire WebWaka OS v4 multi-repo SaaS ecosystem. It is not a standalone application. It is a library consumed by all vertical suite Workers:

- `webwaka-super-admin-v2` — Central management
- Fintech suite Worker(s)
- Transport suite Worker(s)
- Logistics suite Worker(s)
- Health suite Worker(s)
- Real Estate suite Worker(s)

Any change to this library has **platform-wide blast radius**. Breaking changes must be semver-managed and coordinated with all consumers.

### 1.3 Module Inventory

#### `src/core/auth/index.ts` — Auth Module (v1.0.0+)
**Status:** Production-ready. Well-implemented.
**Exports:** `signJWT`, `verifyJWT`, `verifyApiKey`, `jwtAuthMiddleware`, `requireRole`, `requirePermissions`, `secureCORS`, `rateLimit`, `getTenantId`, `getAuthUser`, `JWTPayload`, `AuthUser`, `WakaUser`, `AuthEnv`, `RateLimitEnv`
**Capabilities:**
- HS256 JWT sign/verify using Web Crypto API (edge-compatible)
- Bearer token middleware with public route bypass
- API key auth (SHA-256 hash lookup in D1 `api_keys` table)
- RBAC `requireRole()` and `requirePermissions()` middleware
- Secure CORS with environment-aware origin allowlist (never `*` in production)
- KV-backed sliding-window rate limiter
- Context helpers: `getTenantId()`, `getAuthUser()`
**Invariants enforced:** tenantId from JWT only; CORS never `*`; rate limit on all auth endpoints
**Gaps identified:**
- JWT algorithm is hardcoded to HS256 — no RS256/EdDSA support for public-key verification
- No JWT refresh token mechanism or token revocation list
- Rate limiter uses KV which is eventually consistent — not suitable for strict 100% accuracy
- CORS allowedOrigins is hardcoded to webwaka.com domains — no tenant-customizable CORS
- `verifyApiKey` has no rate limiting itself (just calls DB)
- API key expiry is not enforced (no `expires_at` check in DB query)
- No `X-Request-ID` generation — only propagation

#### `src/core/rbac/index.ts` — RBAC Module (v0.1.0, partially superseded)
**Status:** Partially deprecated. `verifyJwt` is a mock — explicitly a stub. `requireRole`/`requirePermissions` duplicate `src/core/auth/index.ts`.
**Exports:** `Role`, `UserSession`, `requireRole`, `requirePermissions`, `verifyJwt`
**Gaps identified:**
- `verifyJwt()` is a mock returning hardcoded tokens — not production-usable
- `requireRole`/`requirePermissions` use `c.get('session')` not `c.get('user')` — incompatible with auth module
- Role enum (`SUPER_ADMIN`, `TENANT_ADMIN`, `STAFF`, `CUSTOMER`) is not exhaustive for all verticals
- No hierarchical role inheritance
- No permission group definitions or permission registry
- Changelog notes RBAC module is superseded by auth module but it hasn't been removed

#### `src/core/ai/AIEngine.ts` — AI Engine (v1.3.0+)
**Status:** Good. Well-designed three-tier fallback.
**Exports:** `AIEngine`, `generateCompletion`, `CF_DEFAULT_MODEL`, `AIRequest`, `AIResponse`, `TenantConfig`, `AIEngineOptions`, `CompletionConfig`, `CompletionResult`
**Capabilities:**
- Three-tier fallback: Tenant BYOK → Platform OpenRouter → Cloudflare Workers AI
- Per-tier retry with exponential backoff
- Streaming support (`executeStream`)
- Standalone `generateCompletion()` with AbortSignal timeout
**Gaps identified:**
- `generateCompletion` only supports single-prompt (no system message, no multi-turn)
- No token usage tracking / billing integration per completion
- No AI response caching (same prompt re-runs cost money every time)
- Cloudflare AI streaming is a single-chunk fake stream — no true SSE
- No model routing by capability (cost vs. quality tier selection)
- `AIEngine` binds directly to `any` type for CF AI binding — no type safety
- No guardrails / content moderation before sending prompts
- No `X-Title` / `HTTP-Referer` header update mechanism for white-labelled tenants

#### `src/core/billing/index.ts` — Billing Ledger (v0.1.0)
**Status:** Incomplete stub. `getTenantBalance()` always returns 0. D1 SQL is commented out.
**Exports:** `BillingLedger`, `LedgerEntry`, `LedgerEntryType`, `UsageCategory`
**Gaps identified:**
- `getTenantBalance()` is a hardcoded stub — gates on zero balance silently allow unlimited usage
- `recordUsage()` and `recordCredit()` do not write to D1 — only construct in-memory objects
- No subscription plan enforcement (free tier, paid tier, overage limits)
- No billing alerts or threshold webhooks
- No invoice generation support
- No proration logic
- `UsageCategory` is limited to AI_TOKENS, SMS, EMAIL, SUBSCRIPTION — missing STORAGE, API_CALLS, etc.
- No idempotency protection on billing entries

#### `src/core/notifications/index.ts` — Notifications (v1.4.0+)
**Status:** Good. Well-implemented OTP with Voice fallback.
**Exports:** `NotificationService`, `sendOTP`, `NotificationPayload`, `NotificationConfig`, `OtpTenantConfig`, `OtpDeliveryResult`, `OtpDeliveryChannel`
**Gaps identified:**
- `sendPush()` is a mock — returns `true` without doing anything
- Email via Yournotify uses `/v1/campaigns/email` endpoint — no transactional email separation
- No email delivery tracking / webhook handler
- No notification template system (only raw `body` string)
- No retry queue for failed notifications
- No notification preferences / user opt-out handling
- SMS `sendMessage()` in `NotificationService` has no Voice fallback (unlike standalone `sendOTP`)
- No WhatsApp notification channel despite Termii supporting it

#### `src/core/kyc/index.ts` — KYC Engine (v0.1.0)
**Status:** In-memory mock. `mockExternalVerification()` is a stub.
**Exports:** `KYCEngine`, `KYCRequest`
**Gaps identified:**
- All state is in-memory — will be lost on Worker restart (Cloudflare Workers are stateless)
- `processVerification()` calls `mockExternalVerification()` — never calls NIMC/NIBSS/NIBSS2
- No integration with `IKycProvider` from `src/kyc.ts`
- No webhook handler for async verification callbacks from external providers
- No document upload capability (passport image, selfie for liveness detection)
- No KYC level tiering (Tier 1, Tier 2, Tier 3 per CBN guidelines)
- No CAC verification (business KYB)
- Missing `src/kyc.ts` `IKycProvider` implementations (interface only, no concrete implementation)
- No re-verification flow

#### `src/core/geolocation/index.ts` — Geolocation Engine (v0.1.0)
**Status:** Functional but mocked. Real routing always returns stub polyline.
**Exports:** `GeolocationEngine`, `Coordinates`, `Route`
**Gaps identified:**
- `calculateRoute()` uses straight-line Haversine distance — not real road routing
- `polyline` is always `'mock_polyline_data'` — not usable by any frontend
- No reverse geocoding (coordinates → address)
- No forward geocoding (address → coordinates)
- Provider switching exists (`'google' | 'mapbox' | 'osm'`) but all providers use the same mock
- No Nigerian locality awareness (LGAs, states, landmarks)
- No ETA calculation based on real traffic data
- No geofence persistence (each call recalculates from scratch)
- No batch routing for logistics (multi-stop route optimization)

#### `src/core/booking/index.ts` — Booking Engine (v0.1.0)
**Status:** In-memory only. Will lose state on Worker restart.
**Exports:** `BookingEngine`, `Booking`, `TimeSlot`
**Gaps identified:**
- All state is in-memory — stateless Workers cannot use this reliably
- Event bus calls are commented out (`// eventBus.publish(...)`)
- No D1 persistence layer
- No recurring bookings support
- No buffer time between bookings
- No booking confirmation notifications
- No cancellation policy enforcement
- No resource capacity definition (max concurrent bookings per resource)
- No timezone handling (critical for cross-timezone scheduling)

#### `src/core/chat/index.ts` — Chat Engine (v0.1.0)
**Status:** In-memory. Will lose state on Worker restart.
**Exports:** `ChatEngine`, `Message`, `ChatChannel`
**Gaps identified:**
- All state is in-memory — channels and messages disappear on Worker restart
- No Durable Objects integration (required for real-time chat on Workers)
- No WebSocket support
- Event bus calls are commented out
- No message pagination beyond in-memory slice
- No file/image message attachment support
- No message editing or deletion
- No read receipts at scale (only in-memory tracking)
- No push notification on new message

#### `src/core/document/index.ts` — Document Engine (v0.1.0)
**Status:** In-memory only. Signature hash is non-cryptographic.
**Exports:** `DocumentEngine`, `Document`, `Signature`
**Gaps identified:**
- All state is in-memory
- `generateSignatureHash()` uses `hash_${userId}_${Date.now()}` — not a real cryptographic hash
- No PDF generation capability
- No e-signature standard compliance (eIDAS, ESIGN Act)
- No multi-party signature tracking (only marks as `'signed'` after first signature)
- No document versioning
- No document storage (R2 integration missing)
- No document access control beyond tenant scoping

#### `src/core/events/index.ts` — Event Bus (v1.0.0+)
**Status:** Good schema definition. `emitEvent` is functional with KV outbox.
**Exports:** `WebWakaEventType`, `WebWakaEvent`, `DomainEvent`, `createEvent`, `emitEvent`, `EventBusEnv`
**Gaps identified:**
- `DomainEvent` is marked `@deprecated` but still exported and used in some modules
- `emitEvent` uses KV outbox with 24h TTL — no Cloudflare Queues integration (pull vs push)
- No event consumer / subscriber pattern defined
- No dead-letter queue for failed event processing
- No event deduplication (same event can be emitted multiple times)
- HTTP delivery is fire-and-forget with 5s timeout — no retry on HTTP failure
- `WebWakaEventType` enum is missing many commerce/logistics/fintech event types
- No event schema versioning

#### `src/tax.ts` — Tax Engine (v0.1.0+)
**Status:** Functional. Clean implementation.
**Exports:** `TaxEngine`, `TaxConfig`, `TaxLineItem`, `TaxResult`, `createTaxEngine`
**Gaps identified:**
- Only supports VAT — no Withholding Tax (WHT), Custom duties, or stamp duties
- No multi-currency tax computation
- No state-level tax variations (Lagos, Ogun, etc. have different rates for some goods)
- VAT rate is passed in config — no built-in Nigerian standard rate (7.5%) constant
- No `taxRegistrationNumber` validation in config
- No tax receipt generation

#### `src/payment.ts` — Payment Provider (v0.1.0+)
**Status:** Good Paystack integration.
**Exports:** `IPaymentProvider`, `PaystackProvider`, `ChargeResult`, `RefundResult`, `SplitRecipient`, `createPaymentProvider`
**Gaps identified:**
- Only Paystack — no Flutterwave, Mono, or Squad (growing Nigerian alternatives)
- No Paystack webhook verification (HMAC-SHA512 signature check)
- No idempotency key support for transfer/charge operations
- No payment link generation (`/transaction/initialize` returns `authorization_url`)
- No subscription management (recurring billing via Paystack Plans)
- `initiateSplit` uses `transaction/initialize` instead of split API correctly
- No bank account resolution / name enquiry before transfer
- No virtual account creation support

#### `src/rate-limit.ts` — Standalone Rate Limiter (v0.1.0+)
**Status:** Functional.
**Exports:** `checkRateLimit`, `RateLimitOptions`, `RateLimitResult`
**Gaps identified:**
- Increments counter before checking — counter goes up even for rejected requests
- KV is eventually consistent — burst attacks possible across edge nodes
- No IP allowlist / denylist support
- No adaptive rate limiting (tighten limits on suspicious patterns)

#### `src/optimistic-lock.ts` — Optimistic Lock (v0.1.0+)
**Status:** Well-implemented.
**Exports:** `updateWithVersionLock`, `OptimisticLockResult`
**Gaps identified:**
- Table name is interpolated directly into SQL string — SQL injection risk if table name comes from user input
- No retry helper for conflict scenarios
- Assumes `tenantId` column — column name not configurable

#### `src/pin.ts` — PIN Hashing (v0.1.0+)
**Status:** Good. PBKDF2 with 100,000 iterations.
**Exports:** `hashPin`, `verifyPin`
**Gaps identified:**
- Timing attack possible in `verifyPin` — uses string equality (`===`) instead of constant-time comparison
- 100,000 PBKDF2 iterations is the minimum NIST recommendation — should be 310,000+ by current guidance
- No PIN complexity enforcement (4-digit vs 6-digit)
- No PIN history to prevent reuse

#### `src/ndpr.ts` — NDPR Consent (v0.1.0+)
**Status:** Functional but needs regulatory update.
**Exports:** `assertNdprConsent`, `recordNdprConsent`, `NdprConsentLog`
**Gaps identified:**
- NDPR 2019 is superseded by NDPA 2023 and GAID 2025 — regulation reference is outdated
- No consent withdrawal mechanism
- No consent purpose tracking (what data is collected for what purpose)
- No data retention policy enforcement
- No data subject access request (DSAR) support

#### `src/nanoid.ts` — ID Generation (v0.1.0+)
**Status:** Good.
**Exports:** `nanoid`, `genId`
**Gaps identified:**
- Character set bias: `b % CHARS.length` introduces slight modulo bias (62 chars, 256 bytes)
- No sortable ID option (like ULID/KSUID for D1 range queries)

#### `src/ai.ts` — OpenRouter Client (v0.1.0+)
**Status:** Basic. Missing system message support.
**Exports:** `OpenRouterClient`, `createAiClient`, `AiMessage`, `AiCompletionOptions`, `AiCompletionResult`
**Gaps identified:**
- `sendMessage` is not an alias — it wraps `sendOtp` on Termii — this is in `src/sms.ts` not here
- Does not support streaming
- No retry logic
- No request timeout
- `tokensUsed` tracking exists but no integration with billing ledger

#### `src/sms.ts` — SMS Provider (v0.1.0+)
**Status:** Functional. WhatsApp → SMS fallback.
**Exports:** `ISmsProvider`, `TermiiProvider`, `createSmsProvider`, `sendTermiiSms`, `OtpChannel`, `OtpResult`
**Gaps identified:**
- WhatsApp channel is not yet available in some Termii plans — no graceful handling
- No `senderId` validation (must be ≤11 alphanumeric chars)
- API key is stored directly in instance — no rotation support

#### `src/events.ts` — Commerce Events (v0.1.0+)
**Status:** Good constants registry.
**Exports:** `CommerceEvents`, `CommerceEventType`
**Gaps identified:**
- Does not integrate with `WebWakaEventType` from `src/core/events/index.ts` — two parallel event systems
- Missing many events: `USER_REGISTERED`, `USER_DELETED`, `PAYMENT_INITIATED`, `BOOKING_*`, etc.

#### `src/index.ts` — Main Entry Point
**Status:** Good.
**Gaps identified:**
- Does not re-export `src/core/booking`, `src/core/chat`, `src/core/document`, `src/core/geolocation` from root — only from sub-paths
- Missing `src/ndpr.ts` in some export maps

---

### 1.4 Test Coverage Summary

| Module | Test File | Estimated Coverage |
|---|---|---|
| auth | `src/core/auth/index.test.ts` | High (22 tests) |
| AI Engine | `src/core/ai/AIEngine.test.ts` | High (14+ tests) |
| notifications | `src/core/notifications/index.test.ts` | High (17 tests) |
| billing | `src/core/billing/index.test.ts` | Medium (stubs tested) |
| rbac | `src/core/rbac/index.test.ts` | Medium (mock-based) |
| booking | `src/core/booking/index.test.ts` | Low-Medium |
| chat | `src/core/chat/index.test.ts` | Low-Medium |
| kyc | `src/core/kyc/index.test.ts` | Low (mock external) |
| geolocation | `src/core/geolocation/index.test.ts` | Low (Haversine only) |
| document | `src/core/document/index.test.ts` | Low |
| events | `src/core/events/index.test.ts` | Medium |
| tax | `src/tax.test.ts` | High |
| payment | `src/payment.test.ts` | Medium (no webhook) |
| pin | `src/pin.test.ts` | High |
| rate-limit | `src/rate-limit.test.ts` | Medium |
| ndpr | `src/ndpr.test.ts` | Medium |
| nanoid | `src/nanoid.test.ts` | Medium |

### 1.5 CI/CD Configuration

The GitHub Actions workflow (`.github/workflows/publish.yml`) runs on:
- All PRs to `main`: `lint` (tsc --noEmit) + `test` with coverage
- Push to `main`: above + build + publish to npm (if version not already published)

**Gaps:**
- No branch protection rules enforced in CI config itself (GitHub settings separate)
- No changelog validation step
- No semantic release automation
- No vulnerability scanning (npm audit, Dependabot)
- No code size tracking for the published bundle
- No integration/smoke test job against a real Worker environment

---

## SECTION 2 — EXTERNAL BEST-PRACTICE RESEARCH

### 2.1 Cloudflare Workers TypeScript Library Design

Best-in-class Cloudflare Workers library design in 2025-2026:

- **Use `wrangler types` to generate bindings** — not hand-written KVNamespace/D1Database types. The `tsconfig.json` currently manually includes `@cloudflare/workers-types`, which is acceptable but `wrangler types` provides more precise generation.
- **Dual export maps** — Libraries should export both `"types"` and `"import"` paths in package.json `exports` field. Current implementation does this correctly.
- **No Node.js built-ins in library code** — `@webwaka/core` correctly avoids Node.js APIs, using Web Crypto, `fetch`, and TextEncoder exclusively.
- **`exactOptionalPropertyTypes: true`** — Already enforced. This is a leading practice.
- **Tree-shaking via sub-path exports** — Already implemented. Best practice.

### 2.2 JWT Authentication at Scale

World-class JWT practices for 2026:

- **RS256 / EdDSA over HS256** for multi-service verification — HS256 requires sharing the secret with every verifier, RS256/EdDSA allows public key distribution without secret exposure.
- **Token refresh rotation** — Access token (15 min) + rotating refresh token (7 days) stored in HttpOnly cookie.
- **JWT Revocation via KV** — For critical paths (password reset, account takeover), store revoked JTIs in KV.
- **Audience claim (`aud`)** — Enforce audience claim to prevent token reuse across services.
- **`nbf` (not before) claim** — Prevents token use before issuance time (clock skew attacks).

### 2.3 Nigerian Fintech Integration

Leading Nigerian fintech integration patterns:

- **Paystack Webhook Verification** — All Paystack webhooks must verify the `X-Paystack-Signature` header using HMAC-SHA512 against the secret key. This is mandatory and currently missing.
- **Flutterwave as Alternative** — Growing adoption: `flw_ref`, `tx_ref` deduplication pattern, `verify-by-reference` endpoint.
- **Bank Account Resolution** — Before any transfer, validate recipient bank account using Paystack's `/bank/resolve` endpoint.
- **Virtual Accounts** — Paystack Dedicated Virtual Accounts (DVA) for B2C collections. Highly adopted by Nigerian fintechs.
- **Split Payments** — Use Paystack Split API correctly (`/split` endpoint, not inline split during `initialize`).

### 2.4 Nigeria KYC / Compliance

CBN KYC Tier System (mandatory):
- **Tier 1** — Phone + basic info. Max ₦50K daily, ₦300K cumulative.
- **Tier 2** — NIN + address. Max ₦200K daily, ₦5M cumulative.
- **Tier 3** — BVN + NIN + address. Unlimited.

Providers:
- **NIBSS BVN** — Official BVN verification via NIBSS API (licensed fintech access only)
- **NIMC NIN** — NIN verification via NIMC API
- **Youverify / SmileID / Dojah** — Third-party identity verification aggregators widely used in Nigeria
- **Prembly (formerly Identitypass)** — Common aggregator for CAC, BVN, NIN, PASSPORT, DL

### 2.5 NDPR / NDPA 2023 / GAID 2025

Key regulatory changes:
- **NDPR 2019 is superseded** — The NDPA 2023 (Nigeria Data Protection Act) is now the primary law.
- **GAID 2025** — General Application and Implementation Directive effective September 19, 2025.
- **Lawful basis required** — Data processing must declare one of 6 lawful bases per NDPA.
- **Data Subject Rights** — Access, Rectification, Erasure, Portability rights now enforceable.
- **NDPC registration** — Organizations processing personal data of >1000 individuals must register with NDPC.

### 2.6 Event-Driven Architecture on Cloudflare Workers

2025 best practices:
- **Cloudflare Queues** — Replace KV outbox pattern. Queues provide guaranteed delivery, pull-based consumption, configurable batch size, and dead-letter queues.
- **Transactional outbox** — Write to D1 + Queues in same logical operation. Polling worker processes outbox.
- **Event schema versioning** — Include `version: 1` in every event payload for forward compatibility.
- **Consumer groups** — Different consumers (analytics, notifications, audit) can process the same event independently.

### 2.7 Real-Time Communication

Cloudflare Durable Objects for WebSocket:
- **Durable Objects + WebSocket Hibernation API** — The only correct pattern for stateful real-time chat on Workers. Allows DO to sleep between messages, reducing cost 90%+.
- **Room-per-DO pattern** — Each chat channel maps to one Durable Object.
- **Message persistence to D1** — DO holds hot state, D1 holds cold history.
- **Presence tracking** — Track online/offline state within DO.

### 2.8 AI Abstraction Patterns

Leading LLM abstraction patterns in 2026:
- **Semantic caching** — Use vector similarity to cache semantically-equivalent prompts (save 30-60% API costs).
- **Prompt versioning** — Store prompt templates in KV with version numbers. Never hardcode prompts.
- **Token budget management** — Track token usage per tenant per billing cycle against their plan limits.
- **Multi-modal support** — Future-proof by designing interfaces that can accept image/audio inputs.
- **Model fallback chains** — Cost-optimized routing: cheap model first, escalate to expensive on failure.
- **Structured output (JSON mode)** — Use `response_format: { type: "json_object" }` for reliable parsing.

### 2.9 TypeScript Library Packaging

Leading npm library patterns:
- **Separate type declarations** — Use `declaration: true` and `declarationMap: true` (already done).
- **Provenance attestation** — `npm publish --provenance` for supply chain security.
- **SPDX license identifier** — Use machine-readable SPDX identifiers.
- **Size tracking** — Use `bundlesize` or `size-limit` to track published package size.
- **Conventional Commits** — Enforced via `commitlint` + `husky` for automated changelog generation.

### 2.10 Security at Edge

- **Constant-time comparison** — Use `crypto.subtle.timingSafeEqual()` instead of `===` for secrets.
- **Content Security Policy headers** — Inject via middleware.
- **SSRF protection** — Validate URLs before fetching (relevant for geolocation provider calls).
- **Input validation** — Zod or Valibot for schema validation at API boundaries.

---

## SECTION 3 — SYNTHESIS AND GAP ANALYSIS

### 3.1 Critical Security Gaps

| Gap | Risk | Module |
|---|---|---|
| Paystack webhook not verified | HIGH — webhook forgery | `src/payment.ts` |
| PIN verification timing attack | HIGH — PIN bruteforce | `src/pin.ts` |
| `optimistic-lock.ts` table name SQL injection | HIGH | `src/optimistic-lock.ts` |
| KV rate limiter eventually consistent | MEDIUM — burst bypass | `src/core/auth/index.ts` |
| JWT algorithm HS256 shared secret | MEDIUM — secret distribution | `src/core/auth/index.ts` |
| API key has no expiry enforcement | MEDIUM | `src/core/auth/index.ts` |

### 3.2 Critical Functional Gaps

| Gap | Impact | Module |
|---|---|---|
| BillingLedger returns 0 balance always | CRITICAL — free unlimited usage | `src/core/billing/index.ts` |
| KYC uses in-memory mock | CRITICAL — no real verification | `src/core/kyc/index.ts` |
| BookingEngine in-memory (stateless) | CRITICAL — data loss | `src/core/booking/index.ts` |
| ChatEngine in-memory (stateless) | CRITICAL — data loss | `src/core/chat/index.ts` |
| DocumentEngine in-memory | CRITICAL — data loss | `src/core/document/index.ts` |
| GeolocationEngine mock routing | HIGH — wrong ETAs/distances | `src/core/geolocation/index.ts` |
| Push notifications mock | HIGH — undelivered notifications | `src/core/notifications/index.ts` |

### 3.3 Ecosystem Alignment Gaps

| Gap | Impact |
|---|---|
| No Cloudflare Queues integration | Event-driven arch incomplete |
| No Durable Objects patterns for chat/booking | Real-time impossible without it |
| No R2 integration for document storage | Documents cannot persist |
| No D1 migration patterns for core entities | No schema for cross-suite use |
| No Flutterwave provider implementation | Vendor lock-in to Paystack |
| Two parallel event systems (`events.ts` vs `core/events`) | Confusion and duplication |
| `rbac/index.ts` deprecated code still in codebase | Confusion for consumers |

### 3.4 Compliance Gaps

| Gap | Impact |
|---|---|
| NDPR reference (superseded by NDPA 2023/GAID 2025) | Regulatory non-compliance |
| No CBN KYC Tier enforcement | Fintech suite blocked |
| No consent withdrawal mechanism | NDPA non-compliance |
| No data retention policy | NDPA non-compliance |

---

## SECTION 4 — TOP 20 ENHANCEMENTS

1. **T001** — Wire BillingLedger D1 persistence (critical stub resolution)
2. **T002** — Paystack webhook HMAC-SHA512 verification
3. **T003** — Constant-time PIN comparison (security fix)
4. **T004** — Real KYC provider integrations (Dojah/Prembly/Youverify)
5. **T005** — Cloudflare Queues integration for event bus
6. **T006** — Durable Objects-backed ChatEngine (real-time)
7. **T007** — D1-backed BookingEngine (persistent scheduling)
8. **T008** — R2-backed DocumentEngine with real cryptographic signatures
9. **T009** — GeolocationEngine real provider integration (OSRM/Google/Mapbox)
10. **T010** — JWT RS256/EdDSA support + refresh token pattern
11. **T011** — Flutterwave payment provider implementation
12. **T012** — AI token usage tracking + billing ledger integration
13. **T013** — Deprecate and remove `src/core/rbac/index.ts` mock code
14. **T014** — Input validation layer with Zod/Valibot across all modules
15. **T015** — NDPA 2023 / GAID 2025 compliance update
16. **T016** — Push notification real implementation (FCM/Expo)
17. **T017** — Paystack Dedicated Virtual Accounts (DVA) support
18. **T018** — AI semantic response caching with Cloudflare KV
19. **T019** — `nanoid` modulo bias fix + ULID implementation
20. **T020** — CI/CD hardening: audit, provenance, size-limit, commitlint

---

## SECTION 5 — BUG FIX RECOMMENDATIONS

### BF-001 — SQL Injection in `updateWithVersionLock`
**File:** `src/optimistic-lock.ts`
**Severity:** HIGH
**Description:** Table name is interpolated directly into SQL string without validation. If `table` parameter comes from user input, SQL injection is possible.
**Fix:** Whitelist allowed table names with an allowlist array and throw if the table name is not in the list.

### BF-002 — Timing Attack in `verifyPin`
**File:** `src/pin.ts`
**Severity:** HIGH
**Description:** `hash === storedHash` uses JavaScript string equality, which short-circuits on first mismatched character. This enables timing-based oracle attacks to recover PINs.
**Fix:** Use `crypto.subtle.timingSafeEqual()` after encoding both strings as Uint8Array.

### BF-003 — BillingLedger D1 Writes Are No-ops
**File:** `src/core/billing/index.ts`
**Severity:** CRITICAL
**Description:** `recordUsage()` and `recordCredit()` construct LedgerEntry objects but never write them to D1. The comments show the SQL but it is commented out.
**Fix:** Implement the D1 write with proper error handling.

### BF-004 — RBAC Module Uses Wrong Context Key
**File:** `src/core/rbac/index.ts`
**Severity:** MEDIUM
**Description:** `requireRole` and `requirePermissions` in the RBAC module read from `c.get('session')` but the auth module sets `c.get('user')`. These are incompatible.
**Fix:** Either update the RBAC module to use `'user'` key, or deprecate/remove the RBAC middleware entirely (auth module supersedes it).

### BF-005 — API Key Expiry Not Enforced
**File:** `src/core/auth/index.ts`
**Severity:** MEDIUM
**Description:** The `verifyApiKey` SQL query checks `revoked_at IS NULL` but not `expires_at < NOW()`. If the `api_keys` table has an `expires_at` column, expired keys will still be accepted.
**Fix:** Add `AND (expires_at IS NULL OR expires_at > ?)` to the SQL query with the current timestamp.

### BF-006 — Nanoid Modulo Bias
**File:** `src/nanoid.ts`
**Severity:** LOW
**Description:** `b % CHARS.length` with `b` being 0-255 and `CHARS.length` being 62 introduces slight bias (256 % 62 = 10, so chars 0-9 of CHARS are slightly more likely).
**Fix:** Use rejection sampling — discard bytes where `b >= Math.floor(256 / CHARS.length) * CHARS.length`.

### BF-007 — Rate Limit Counter Incremented Before Rejection Check
**File:** `src/rate-limit.ts`
**Severity:** MEDIUM
**Description:** In `checkRateLimit`, the count is incremented (`count += 1`) and written to KV only when `count < maxRequests`. However, the counter is read before the check. The increment does not happen on rejection — this is actually correct. However, the function increments and writes even for the first request per window, which is correct. The issue is that KV is eventually consistent — a flood of concurrent requests can all read `count = 0` and all be allowed before any writes propagate.
**Fix:** Document the eventual consistency limitation clearly. Consider Cloudflare Rate Limiting (managed) for strict enforcement.

---

## SECTION 6 — TASK BREAKDOWN

---

### T001 — Wire BillingLedger D1 Persistence

**Title:** Implement BillingLedger D1 database persistence
**Priority:** CRITICAL
**Phase:** Phase 1
**Objective:** Replace the stub `getTenantBalance()` (always returns 0) and the no-op `recordUsage()`/`recordCredit()` methods with real D1 database writes and reads.
**Why It Matters:** As long as `getTenantBalance()` returns 0, any gating logic on balance (credit limits, overage protection) will silently allow unlimited usage, potentially costing the platform money.
**Repo Scope:** `src/core/billing/index.ts`, `src/index.ts`
**Dependencies:** D1 database binding must be properly typed (not `any`)
**Prerequisites:** Decision on D1 schema for `billing_ledger_entries` table
**Impacted Modules:** Billing, any vertical suite that calls billing
**Likely Files/Areas to Change:**
- `src/core/billing/index.ts` — Implement D1 SQL
- Add D1 schema SQL to `docs/migrations/001_billing_ledger.sql`
**Expected Output:** `recordUsage()`, `recordCredit()`, and `getTenantBalance()` perform real D1 operations
**Acceptance Criteria:**
- `recordUsage()` inserts a row in `billing_ledger_entries`
- `recordCredit()` inserts a row in `billing_ledger_entries`
- `getTenantBalance()` queries D1 and returns the real sum
- All existing tests pass
- New tests cover the D1 interaction via Vitest mocks
**Tests Required:** Unit tests with D1 mock; verify SQL correctness
**Risks:** D1 transaction support is limited; ensure idempotency
**Governance:** Blueprint Part 10.1, Part 9.1 #6 (integer kobo)
**Reminders:** All amounts MUST be integer kobo. Never float. Never naira without explicit conversion.

---

### T002 — Paystack Webhook HMAC-SHA512 Verification

**Title:** Add Paystack webhook signature verification
**Priority:** HIGH
**Phase:** Phase 1
**Objective:** Implement a `verifyPaystackWebhook(rawBody: string, signature: string, secretKey: string): Promise<boolean>` function that verifies the `X-Paystack-Signature` header using HMAC-SHA512.
**Why It Matters:** Without webhook verification, any attacker can forge Paystack webhook events (payment confirmed, refund processed) and trigger fraudulent state changes.
**Repo Scope:** `src/payment.ts`
**Dependencies:** Web Crypto API (already available in Workers)
**Prerequisites:** None
**Impacted Modules:** Payment, any suite processing payment webhooks
**Likely Files/Areas to Change:**
- `src/payment.ts` — Add `verifyPaystackWebhook` export
- `src/index.ts` — Re-export
**Expected Output:** Exported `verifyPaystackWebhook` function using `crypto.subtle`
**Acceptance Criteria:**
- Valid signature returns `true`
- Invalid/tampered signature returns `false`
- Wrong secret key returns `false`
- Function is exported from `src/payment.ts` and `src/index.ts`
**Tests Required:** Unit tests with known good/bad HMAC-SHA512 fixtures
**Risks:** Must use constant-time comparison (HMAC compare is generally safe via subtle.verify)
**Governance:** Paystack documentation; Blueprint Part 10.11
**Reminders:** Use `crypto.subtle.sign('HMAC', key, data)` then compare with `crypto.subtle.verify`. Never use string comparison.

---

### T003 — Constant-Time PIN Comparison (Security Fix)

**Title:** Fix timing attack in verifyPin
**Priority:** HIGH (Security)
**Phase:** Phase 1
**Objective:** Replace the `===` string comparison in `verifyPin()` with a constant-time comparison using `crypto.subtle.timingSafeEqual()` or equivalent.
**Why It Matters:** Timing attacks on PIN verification allow an attacker to infer PIN bits through response time measurement, even against PBKDF2-hashed PINs.
**Repo Scope:** `src/pin.ts`
**Dependencies:** None (Web Crypto already available)
**Prerequisites:** None
**Impacted Modules:** PIN module, any auth flow using `verifyPin`
**Likely Files/Areas to Change:**
- `src/pin.ts` — `verifyPin()` comparison logic
**Expected Output:** Timing-safe comparison using ArrayBuffer byte comparison
**Acceptance Criteria:**
- Correct PIN returns `true`
- Wrong PIN returns `false`
- Comparison time is constant regardless of how many bytes match
**Tests Required:** Functional tests (correct/incorrect PIN). Note: timing-safety cannot be unit-tested — document the approach.
**Risks:** Low. `TextEncoder + crypto.subtle.timingSafeEqual` is well-tested.
**Governance:** NIST SP 800-132; Blueprint Part 9.2
**Reminders:** Cloudflare Workers runtime supports `crypto.subtle` fully. No Node.js `crypto` needed.

---

### T004 — Real KYC Provider Integrations

**Title:** Implement IKycProvider with Dojah/Prembly/Youverify concrete integrations
**Priority:** HIGH
**Phase:** Phase 1 (interface + one provider), Phase 2 (additional providers)
**Objective:** Replace the in-memory mock `KYCEngine` with real API calls to a Nigerian KYC aggregator provider (Dojah recommended as Phase 1 target).
**Why It Matters:** The KYC module uses `mockExternalVerification()` which approves any document number not starting with `000`. No real identity is verified. Fintech verticals cannot go live with this.
**Repo Scope:** `src/core/kyc/index.ts`, `src/kyc.ts`
**Dependencies:** `IKycProvider` interface already defined in `src/kyc.ts`
**Prerequisites:** Dojah API documentation; tenant API key in KV
**Impacted Modules:** KYC, any fintech/transport suite using identity verification
**Likely Files/Areas to Change:**
- `src/kyc.ts` — Add `DojahKycProvider` implementing `IKycProvider`
- `src/core/kyc/index.ts` — Wire async D1 persistence (not in-memory)
**Expected Output:** `DojahKycProvider` class that makes real HTTPS calls to Dojah API
**Acceptance Criteria:**
- BVN verification calls Dojah BVN endpoint
- NIN verification calls Dojah NIN endpoint
- CAC verification calls Dojah CAC endpoint
- All results are persisted to D1 (not in-memory)
- API key always comes from constructor parameter (never hardcoded)
**Tests Required:** Mocked fetch tests for each verification type
**Risks:** Dojah API may change; rate limits; cost per verification call
**Governance:** CBN KYC guidelines; NDPA 2023; Blueprint Part 10.11

---

### T005 — Cloudflare Queues Integration for Event Bus

**Title:** Replace KV outbox with Cloudflare Queues in emitEvent
**Priority:** HIGH
**Phase:** Phase 2
**Objective:** Refactor `emitEvent()` to publish to Cloudflare Queues instead of (or in addition to) the KV outbox pattern. Define a queue consumer interface.
**Why It Matters:** KV outbox has 24h TTL and no guaranteed delivery. Cloudflare Queues provide at-least-once delivery, configurable retry, and dead-letter queue support — the correct foundation for event-driven architecture.
**Repo Scope:** `src/core/events/index.ts`
**Dependencies:** Cloudflare Queues binding type from `@cloudflare/workers-types`
**Prerequisites:** Platform decision on Queue naming conventions
**Impacted Modules:** All modules emitting events
**Likely Files/Areas to Change:**
- `src/core/events/index.ts` — Add `Queue` binding support to `emitEvent`
- `EventBusEnv` interface — Add optional `QUEUE?: Queue`
**Expected Output:** `emitEvent` uses Queue when available, falls back to KV+HTTP
**Acceptance Criteria:**
- When `env.QUEUE` binding present, event is sent to Queue
- Queue message follows `WebWakaEvent<T>` schema
- KV outbox is retained as fallback
- All existing tests pass
**Tests Required:** Unit tests mocking Queue.send()
**Risks:** Queue binding must be configured per Worker — consumers must update their wrangler.toml
**Governance:** Blueprint Part 2 (Event-Driven); Part 9.3 (Observability)

---

### T006 — Durable Objects-Backed ChatEngine

**Title:** Refactor ChatEngine to use Cloudflare Durable Objects with WebSocket Hibernation
**Priority:** HIGH
**Phase:** Phase 2
**Objective:** Replace the in-memory `ChatEngine` with a Durable Object-based implementation that supports real-time WebSocket communication, persistent message history in D1, and presence tracking.
**Why It Matters:** In-memory `ChatEngine` loses all messages and channels on every Worker restart. Real-time chat is impossible without Durable Objects.
**Repo Scope:** `src/core/chat/index.ts`
**Dependencies:** Durable Objects types from `@cloudflare/workers-types`; D1 for message persistence
**Prerequisites:** Durable Object namespace binding conventions defined
**Impacted Modules:** Chat, any suite with operator-customer messaging
**Likely Files/Areas to Change:**
- `src/core/chat/index.ts` — Add `ChatRoom` Durable Object class
- `src/core/chat/index.ts` — Refactor `ChatEngine` to be a thin client directing to DO
**Expected Output:** `ChatRoom` DO class with WebSocket accept, hibernation, D1 persistence
**Acceptance Criteria:**
- Messages persist across Worker restarts (stored in D1 via DO)
- WebSocket connections are properly hibernated when idle
- `sendMessage()`, `getMessages()`, `markAsRead()` are all DO-backed
- Tenant isolation enforced at DO namespace key level
**Tests Required:** DO testing requires Miniflare or Wrangler dev environment
**Risks:** DO pricing model; need to limit DO instances per tenant
**Governance:** Blueprint Part 10 (All Verticals); Cloudflare DO docs

---

### T007 — D1-Backed BookingEngine

**Title:** Refactor BookingEngine from in-memory to D1 persistence
**Priority:** HIGH
**Phase:** Phase 1
**Objective:** Replace the in-memory `BookingEngine` with D1 database persistence, fixing the stateless data loss issue.
**Why It Matters:** In-memory `BookingEngine` loses all bookings on every Worker restart. Health, Transport, and other verticals cannot use this reliably.
**Repo Scope:** `src/core/booking/index.ts`
**Dependencies:** D1 binding; D1 schema for bookings table
**Prerequisites:** Booking D1 schema defined
**Impacted Modules:** Booking, Transport, Health verticals
**Likely Files/Areas to Change:**
- `src/core/booking/index.ts` — Replace `this.bookings: Booking[]` with D1 queries
- Add D1 schema to `docs/migrations/002_bookings.sql`
**Expected Output:** `BookingEngine` accepts `D1Database` in constructor, all operations query D1
**Acceptance Criteria:**
- `createBooking()` inserts into D1
- `cancelBooking()` updates D1 row
- `isAvailable()` queries D1 for conflicts
- Tenant isolation enforced via `tenantId` in all queries
- Bookings survive Worker restarts
**Tests Required:** D1 mock tests; conflict detection tests
**Risks:** D1 latency per query; need to ensure booking conflict check is atomic
**Governance:** Blueprint Part 10.3 (Transport), 10.7 (Health)

---

### T008 — R2-Backed DocumentEngine with Real Signatures

**Title:** Refactor DocumentEngine with R2 storage and real cryptographic signatures
**Priority:** MEDIUM
**Phase:** Phase 2
**Objective:** Replace in-memory document storage with R2 blob storage and replace the fake `generateSignatureHash()` with real Web Crypto signatures.
**Why It Matters:** Documents are legal instruments. An in-memory store loses them instantly. The fake signature hash (`hash_${userId}_${Date.now()}`) is not cryptographically verifiable.
**Repo Scope:** `src/core/document/index.ts`
**Dependencies:** R2 binding from `@cloudflare/workers-types`; Web Crypto
**Prerequisites:** R2 bucket naming convention; D1 schema for document metadata
**Impacted Modules:** Document, Real Estate, Legal verticals
**Likely Files/Areas to Change:**
- `src/core/document/index.ts` — R2 for content, D1 for metadata, crypto.subtle for hashing
**Expected Output:** Documents stored in R2; metadata in D1; signatures are SHA-256 hashes of content
**Acceptance Criteria:**
- `createDocument()` writes content to R2, metadata to D1
- `signDocument()` computes SHA-256 hash of document content using Web Crypto
- All documents retrievable by ID with correct tenant scoping
**Tests Required:** R2 mock tests; signature verification tests
**Risks:** R2 egress costs; large documents need streaming
**Governance:** Blueprint Part 10.5 (Real Estate), 10.12 (Legal)

---

### T009 — GeolocationEngine Real Provider Integration

**Title:** Implement real routing in GeolocationEngine (OSRM for OSM, Google Maps API, Mapbox)
**Priority:** MEDIUM
**Phase:** Phase 1 (OSRM/OSM — free), Phase 2 (Google/Mapbox)
**Objective:** Replace the Haversine straight-line mock in `calculateRoute()` with real road routing and real geocoding.
**Why It Matters:** `'mock_polyline_data'` cannot be rendered on any map. Haversine distance for road routing produces drastically wrong ETAs in dense Nigerian city traffic.
**Repo Scope:** `src/core/geolocation/index.ts`
**Dependencies:** OSRM public API or Google Maps Platform key
**Prerequisites:** Provider decision; API key management in KV
**Impacted Modules:** Geolocation, Transport, Logistics verticals
**Likely Files/Areas to Change:**
- `src/core/geolocation/index.ts` — Real fetch calls to routing APIs
**Expected Output:** `calculateRoute()` returns real distance/duration/polyline from provider
**Acceptance Criteria:**
- OSRM provider makes real call to `router.project-osrm.org`
- Google provider calls Directions API with API key from config
- Polyline is a valid encoded polyline string
- Fallback to Haversine if all providers fail
**Tests Required:** Mocked fetch tests per provider; fallback test
**Risks:** OSRM rate limits; API costs; Nigerian road data quality
**Governance:** Blueprint Part 10.3 (Transport), 10.4 (Logistics)

---

### T010 — JWT RS256/EdDSA Support + Refresh Tokens

**Title:** Add RS256/EdDSA JWT support and refresh token rotation pattern
**Priority:** MEDIUM
**Phase:** Phase 2
**Objective:** Add support for asymmetric JWT signing (RS256 or EdDSA) to allow public-key verification across services without sharing the secret. Add refresh token generation and rotation.
**Why It Matters:** HS256 requires every verifying service to hold the JWT secret. As more WebWaka services verify tokens, the blast radius of secret compromise grows. RS256/EdDSA allows public key distribution.
**Repo Scope:** `src/core/auth/index.ts`
**Dependencies:** Web Crypto SubtleCrypto (RS256/EdDSA support in Workers confirmed)
**Prerequisites:** Key pair generation strategy; key rotation plan
**Impacted Modules:** Auth, all suites using jwtAuthMiddleware
**Likely Files/Areas to Change:**
- `src/core/auth/index.ts` — `signJWT()` and `verifyJWT()` with algorithm parameter
**Expected Output:** `signJWT(payload, key, { algorithm: 'RS256' | 'HS256' })` polymorphic API
**Acceptance Criteria:**
- HS256 (existing) path continues to work
- RS256 sign/verify round-trip works with generated key pair
- Exported `JWTAlgorithm` type union
**Tests Required:** RS256 sign/verify tests; HS256 regression tests
**Risks:** Breaking change risk — must be additive. Key distribution strategy needed outside this repo.
**Governance:** Blueprint Part 9.2

---

### T011 — Flutterwave Payment Provider

**Title:** Add FlutterwaveProvider implementing IPaymentProvider
**Priority:** MEDIUM
**Phase:** Phase 2
**Objective:** Implement `FlutterwaveProvider` as a second `IPaymentProvider` implementation for tenants who use Flutterwave instead of Paystack.
**Why It Matters:** Flutterwave is the second major Nigerian payment gateway. Vendor neutrality for payments is as important as for AI. Some tenants may prefer Flutterwave for its diaspora payment capabilities.
**Repo Scope:** `src/payment.ts`
**Dependencies:** Flutterwave API documentation
**Prerequisites:** `IPaymentProvider` interface is already stable
**Impacted Modules:** Payment, Billing, any suite doing transactions
**Likely Files/Areas to Change:**
- `src/payment.ts` — Add `FlutterwaveProvider` class, `createFlutterwaveProvider` factory
**Expected Output:** `FlutterwaveProvider` with `verifyCharge`, `initiateRefund`, `initiateSplit`, `initiateTransfer`
**Acceptance Criteria:**
- Implements all `IPaymentProvider` methods
- Webhook signature verification also implemented
- All amounts in kobo (Flutterwave uses kobo internally too)
- `createFlutterwaveProvider(secretKey)` factory exported
**Tests Required:** Mocked fetch tests for all four operations
**Risks:** Flutterwave API differences from Paystack; webhook format differences
**Governance:** Blueprint Part 10.11 (Fintech)

---

### T012 — AI Token Usage Tracking + Billing Integration

**Title:** Wire AI token usage into BillingLedger after each completion
**Priority:** MEDIUM
**Phase:** Phase 2 (after T001 BillingLedger D1 is complete)
**Objective:** After every successful AI completion (via `AIEngine.execute()` or `generateCompletion()`), record a `DEBIT` entry in `BillingLedger` for `UsageCategory.AI_TOKENS` with the token count in kobo equivalent.
**Why It Matters:** Without usage tracking, the platform cannot enforce tenant AI usage limits or charge for AI API costs.
**Repo Scope:** `src/core/ai/AIEngine.ts`
**Dependencies:** T001 (BillingLedger D1); token pricing configuration
**Prerequisites:** Token-to-kobo pricing table; `BillingLedger` D1 working
**Impacted Modules:** AI, Billing
**Likely Files/Areas to Change:**
- `src/core/ai/AIEngine.ts` — Post-completion billing hook
- `src/core/ai/AIEngine.ts` — `AIRequest` or `CompletionConfig` needs `billingLedger` optional param
**Expected Output:** Every successful AI call records a billing debit
**Acceptance Criteria:**
- Token count extracted from OpenRouter response
- Billing debit recorded with `category: UsageCategory.AI_TOKENS`
- Billing failure does NOT fail the AI call (non-blocking)
**Tests Required:** Tests verify billing is called with correct amount; billing failure does not throw
**Risks:** Token counts not always available; CF AI has no token count response
**Governance:** Blueprint Part 10.1 (Economics)

---

### T013 — Deprecate and Remove RBAC Mock Module

**Title:** Clean up src/core/rbac/index.ts — deprecate mock verifyJwt, unify context keys
**Priority:** MEDIUM
**Phase:** Phase 1
**Objective:** Remove the mock `verifyJwt()` from `src/core/rbac/index.ts` and update `requireRole`/`requirePermissions` to use `c.get('user')` (matching the auth module) instead of `c.get('session')`.
**Why It Matters:** The RBAC module's `verifyJwt` is a mock that always returns hardcoded sessions. Any consumer accidentally using it instead of the auth module bypasses real authentication. The context key mismatch (`'session'` vs `'user'`) silently breaks middleware chains.
**Repo Scope:** `src/core/rbac/index.ts`, `src/index.ts`
**Dependencies:** `src/core/auth/index.ts` (the replacement)
**Prerequisites:** Confirm no consumers are using `rbac.requireRole` (vs `auth.requireRole`)
**Impacted Modules:** RBAC, any suite that imported from `@webwaka/core/rbac`
**Likely Files/Areas to Change:**
- `src/core/rbac/index.ts` — Remove `verifyJwt`; update context key to `'user'`; add deprecation notices
**Expected Output:** RBAC module is clean, context-compatible, and the mock is gone
**Acceptance Criteria:**
- `verifyJwt` is removed
- `requireRole` reads from `c.get('user')`
- Deprecation notice on remaining RBAC exports directing consumers to `@webwaka/core/auth`
- All RBAC tests updated
**Tests Required:** Regression tests for `requireRole` and `requirePermissions`
**Risks:** Breaking change for any consumer using `c.get('session')`
**Governance:** Changelog requirement; semver major bump if breaking

---

### T014 — Input Validation Layer with Valibot

**Title:** Add Valibot schema validation at all public API boundaries
**Priority:** MEDIUM
**Phase:** Phase 2
**Objective:** Integrate Valibot (lightweight, tree-shakeable, zero-dependency) for input validation on all public functions that accept user-provided data.
**Why It Matters:** No input validation exists. A caller passing `amountKobo: 1.5` to `recordUsage()` would violate the integer kobo invariant silently. Phone numbers, email addresses, and document numbers are never validated.
**Repo Scope:** All modules
**Dependencies:** `valibot` (10kb, no dependencies, ESM-native)
**Prerequisites:** Package installation
**Impacted Modules:** All
**Likely Files/Areas to Change:**
- `src/core/billing/index.ts` — Validate `amountKobo`
- `src/core/notifications/index.ts` — Validate phone format (E.164)
- `src/payment.ts` — Validate reference, amounts
- `src/core/kyc/index.ts` — Validate document numbers by type
- `src/core/auth/index.ts` — Validate JWT format before parsing
**Expected Output:** `valibot` schemas defined and validated at function entry points
**Acceptance Criteria:**
- Invalid inputs throw `ValidationError` with field-level messages
- Valid inputs pass through unchanged
- No regression in existing tests
**Tests Required:** Tests for invalid inputs per module
**Risks:** Bundle size increase (minimal with Valibot); breaking change for some callers
**Governance:** Blueprint Part 9.2 (Correctness)

---

### T015 — NDPA 2023 / GAID 2025 Compliance Update

**Title:** Update NDPR consent module to reflect NDPA 2023 and GAID 2025
**Priority:** HIGH
**Phase:** Phase 1
**Objective:** Update `src/ndpr.ts` to reflect the new Nigeria Data Protection Act 2023 and GAID 2025 requirements: lawful basis tracking, consent withdrawal, data subject rights, retention policies.
**Why It Matters:** The current module references NDPR 2019 which is superseded. NDPA 2023 introduces new requirements that are missing from the current implementation.
**Repo Scope:** `src/ndpr.ts`
**Dependencies:** NDPA 2023 text; GAID 2025
**Prerequisites:** Legal review of NDPA requirements
**Impacted Modules:** NDPR, any module processing personal data
**Likely Files/Areas to Change:**
- `src/ndpr.ts` — Add `LawfulBasis` enum; `assertNdpaConsent()`; `recordConsentWithdrawal()`; `getConsentsForEntity()`
**Expected Output:** Full NDPA-compliant consent and rights management utilities
**Acceptance Criteria:**
- `assertNdpaConsent()` validates lawful basis claim in request body
- `recordConsentWithdrawal()` inserts withdrawal record in D1
- `getConsentsForEntity()` returns paginated consent history for DSAR
- All comments updated to reference NDPA 2023, not NDPR 2019
**Tests Required:** Tests for each new function; D1 mock tests
**Risks:** Regulatory interpretation may differ; recommend legal review
**Governance:** NDPA 2023; GAID 2025; NDPC guidelines

---

### T016 — Real Push Notification Implementation

**Title:** Implement real push notifications via FCM and/or Expo Push
**Priority:** MEDIUM
**Phase:** Phase 2
**Objective:** Replace the mock `sendPush()` in `NotificationService` with real push notification delivery via Firebase Cloud Messaging (FCM) and Expo Push Notifications API.
**Why It Matters:** The current `sendPush()` logs a message and returns `true` without doing anything. Any WebWaka suite relying on push for critical user alerts (booking confirmed, payment received) silently fails.
**Repo Scope:** `src/core/notifications/index.ts`
**Dependencies:** FCM API key or Expo Push API (no SDK needed for REST)
**Prerequisites:** Push token storage strategy (D1 per-tenant push_tokens table)
**Impacted Modules:** Notifications, all verticals with mobile/PWA users
**Likely Files/Areas to Change:**
- `src/core/notifications/index.ts` — `sendPush()` real FCM/Expo REST calls
- `NotificationConfig` — Add `fcmServerKey?: string` or `expoPushToken` endpoint
**Expected Output:** `sendPush()` makes real FCM or Expo API call with device token
**Acceptance Criteria:**
- FCM REST API called with correct Authorization header
- Expo Push API called for Expo managed apps
- Failure does not crash — logs error and returns false
**Tests Required:** Mocked fetch tests for FCM and Expo paths
**Risks:** Device token management is external; tokens expire and must be refreshed
**Governance:** Blueprint Part 10 (All Verticals — Mobile First)

---

### T017 — Paystack Dedicated Virtual Accounts (DVA) Support

**Title:** Add Paystack DVA support to IPaymentProvider
**Priority:** MEDIUM
**Phase:** Phase 2
**Objective:** Extend `IPaymentProvider` and `PaystackProvider` with `createVirtualAccount()` and `getVirtualAccount()` methods for Dedicated Virtual Accounts.
**Why It Matters:** DVAs are the dominant collection mechanism for Nigerian B2C fintechs. Each customer gets a unique account number; payments automatically trigger a webhook. This is essential for wallet top-ups, savings products, and marketplace escrow.
**Repo Scope:** `src/payment.ts`
**Dependencies:** Paystack DVA API
**Prerequisites:** Paystack account with DVA enabled (requires application)
**Impacted Modules:** Payment, Fintech vertical, Billing
**Likely Files/Areas to Change:**
- `src/payment.ts` — Add `IVirtualAccountProvider` interface; `PaystackProvider` implements it
**Expected Output:** `createVirtualAccount(customerId, preferredBank)` and `getVirtualAccount(customerId)` methods
**Acceptance Criteria:**
- DVA creation API called correctly
- Bank code validated from Paystack bank list
- Virtual account details (account number, bank name) returned correctly
- Webhook for DVA funding verified with `verifyPaystackWebhook`
**Tests Required:** Mocked fetch tests for DVA creation/retrieval
**Risks:** DVA requires separate Paystack onboarding; not all banks supported
**Governance:** Blueprint Part 10.11 (Fintech)

---

### T018 — AI Semantic Response Caching

**Title:** Add KV-backed semantic caching for AI completions
**Priority:** LOW
**Phase:** Phase 2
**Objective:** Add an optional KV-backed cache to `generateCompletion()` and `AIEngine.execute()` that caches responses by a hash of the prompt. On cache hit, return the cached response without making an API call.
**Why It Matters:** Repeated identical prompts (e.g., FAQ answers, standard explanations) waste money on API calls. A simple cache can reduce AI API costs by 30-60% in production.
**Repo Scope:** `src/core/ai/AIEngine.ts`
**Dependencies:** KV binding
**Prerequisites:** Cache TTL strategy; opt-in design to not break existing callers
**Impacted Modules:** AI
**Likely Files/Areas to Change:**
- `src/core/ai/AIEngine.ts` — Optional `cacheKv?: KVNamespace` in options; SHA-256 key of prompt
**Expected Output:** When `cacheKv` provided, cache checked before API call; response cached on miss
**Acceptance Criteria:**
- Cache hit returns instantly without calling OpenRouter
- Cache miss calls API and stores result with configurable TTL
- Cache key is SHA-256 of `${model}:${prompt}` (consistent across calls)
- Cache can be disabled by not providing `cacheKv`
**Tests Required:** Tests for cache hit, cache miss, and cache disabled paths
**Risks:** Stale cached responses for time-sensitive prompts; opt-in design mitigates
**Governance:** Blueprint Part 9.1 #7 (Vendor Neutral AI)

---

### T019 — Nanoid Modulo Bias Fix + ULID Export

**Title:** Fix nanoid modulo bias and add ULID generation for sortable IDs
**Priority:** LOW
**Phase:** Phase 1
**Objective:** Fix the modulo bias in `src/nanoid.ts` using rejection sampling. Also add a `generateUlid()` function for generating sortable, time-prefixed IDs useful for D1 range queries.
**Why It Matters:** Modulo bias makes some characters slightly more likely than others — this weakens ID unpredictability at high volume. ULIDs are needed when D1 entries need time-ordered range queries.
**Repo Scope:** `src/nanoid.ts`
**Dependencies:** None
**Prerequisites:** None
**Impacted Modules:** nanoid, any module generating IDs
**Likely Files/Areas to Change:**
- `src/nanoid.ts` — Rejection sampling in `nanoid()`; add `generateUlid()`
**Expected Output:** Unbiased `nanoid()` and new `generateUlid()` with time prefix
**Acceptance Criteria:**
- `nanoid()` characters are uniformly distributed
- `generateUlid()` returns 26-character Crockford base32 ID with millisecond precision prefix
- Both are sortable by creation time (ULID is inherently; nanoid is not)
**Tests Required:** Statistical distribution test; ULID format test; sort order test
**Risks:** None. No breaking change.
**Governance:** Blueprint Part 9.1 (Infrastructure)

---

### T020 — CI/CD Hardening

**Title:** Add security scanning, bundle size tracking, provenance, and commitlint to CI/CD
**Priority:** MEDIUM
**Phase:** Phase 1
**Objective:** Harden the CI/CD pipeline with: npm audit (security), `size-limit` for bundle size tracking, npm provenance attestation on publish, and `commitlint` for enforcing Conventional Commits.
**Why It Matters:** As a shared library with platform-wide blast radius, `@webwaka/core` needs supply chain security guarantees. Provenance attestation links every published npm package to its source commit.
**Repo Scope:** `.github/workflows/publish.yml`, `package.json`
**Dependencies:** `size-limit`, `@commitlint/cli`, `@commitlint/config-conventional`
**Prerequisites:** None
**Impacted Modules:** CI/CD only
**Likely Files/Areas to Change:**
- `.github/workflows/publish.yml` — Add audit, size-limit, provenance steps
- `package.json` — Add `size-limit` config and commitlint config
**Expected Output:** CI fails on: security vulnerabilities, bundle size regression, non-conventional commits
**Acceptance Criteria:**
- `npm audit --audit-level=high` runs and fails CI on high/critical vulns
- `size-limit` configured with a max bundle size (e.g., 50KB)
- `pnpm publish --provenance` used for npm publication
- Commitlint runs on PR title or commit messages
**Tests Required:** Verify CI passes with a conventional commit; verify CI fails with a non-conventional commit
**Risks:** Size limit may be too strict initially — start permissive and tighten
**Governance:** Supply chain security; Blueprint Part 9.3

---

### T021 — Webhook Verification Library Expansion

**Title:** Add webhook verification for Flutterwave, Termii, and Yournotify
**Priority:** MEDIUM
**Phase:** Phase 2
**Objective:** Alongside the Paystack webhook verifier (T002), add similar verification functions for Flutterwave (`X-Flutterwave-Signature` HMAC-SHA256), Termii delivery reports, and Yournotify delivery callbacks.
**Why It Matters:** Every inbound webhook from a payment or notification provider must be verified to prevent forgery attacks. Missing verification creates critical fraud vectors.
**Repo Scope:** `src/payment.ts`, `src/core/notifications/index.ts`, `src/sms.ts`
**Dependencies:** T002 (Paystack webhook) complete
**Prerequisites:** Flutterwave, Termii, Yournotify webhook documentation
**Impacted Modules:** Payment, Notifications, SMS
**Likely Files/Areas to Change:**
- `src/payment.ts` — `verifyFlutterwaveWebhook()`
- `src/sms.ts` — `verifyTermiiWebhook()`
- `src/core/notifications/index.ts` — `verifyYournotifyWebhook()`
**Expected Output:** Three new exported verification functions
**Acceptance Criteria:**
- Each function returns boolean; uses `crypto.subtle`; is constant-time
**Tests Required:** Good/bad signature tests per provider
**Risks:** Webhook formats may change; pin to provider documentation versions
**Governance:** Blueprint Part 10.11, 10.12

---

### T022 — Paystack Webhook Signature Fix + Bank Resolution

**Title:** Add Paystack bank account name enquiry before transfers
**Priority:** HIGH
**Phase:** Phase 1
**Objective:** Add `resolveAccountName(accountNumber, bankCode, secretKey)` to the payment module that calls Paystack's `/bank/resolve` endpoint to confirm a bank account exists before initiating a transfer.
**Why It Matters:** Without account name resolution, transfers to wrong account numbers succeed and are nearly impossible to recover. CBN regulations require name match before high-value transfers.
**Repo Scope:** `src/payment.ts`
**Dependencies:** T002 (Paystack webhook)
**Prerequisites:** None
**Impacted Modules:** Payment, Fintech vertical
**Likely Files/Areas to Change:**
- `src/payment.ts` — `resolveAccountName()` standalone function; add to `IPaymentProvider`
**Expected Output:** `resolveAccountName()` returns `{ accountName: string; accountNumber: string; bankId: number }`
**Acceptance Criteria:**
- Correct account returns name
- Invalid account throws or returns error shape
- Wrong bank code returns error
**Tests Required:** Mocked fetch tests
**Risks:** Paystack rate limits `/bank/resolve`; add per-IP caching in KV
**Governance:** Blueprint Part 10.11 (Fintech)

---

### T023 — CBN KYC Tier Enforcement in KYC Module

**Title:** Add CBN KYC Tier system enforcement
**Priority:** HIGH
**Phase:** Phase 2
**Objective:** Implement `KycTierResult` and `getKycTier(tenantId, userId, db)` that returns the current CBN KYC tier (1, 2, or 3) for a user and their applicable transaction limits.
**Why It Matters:** Every Nigerian fintech must enforce CBN KYC tiers. Without this primitive, fintech suites must reimplement tier logic themselves, creating inconsistency.
**Repo Scope:** `src/core/kyc/index.ts`
**Dependencies:** T004 (Real KYC integrations)
**Prerequisites:** D1 schema for kyc_verifications table
**Impacted Modules:** KYC, Fintech
**Likely Files/Areas to Change:**
- `src/core/kyc/index.ts` — Add `KycTier` enum, `getKycTier()`, `KycTierLimits`
**Expected Output:** `getKycTier(tenantId, userId, db)` returns `{ tier: 1 | 2 | 3; dailyLimit: number; cumulativeLimit: number }`
**Acceptance Criteria:**
- Tier 1 = phone only → ₦50K/day, ₦300K cumulative
- Tier 2 = NIN verified → ₦200K/day, ₦5M cumulative
- Tier 3 = BVN + NIN → unlimited
- Limits returned in kobo
**Tests Required:** Tier determination tests for each combination
**Risks:** CBN limits may change; pin to current guidelines with a note to update
**Governance:** CBN KYC guidelines 2023; Blueprint Part 10.11

---

### T024 — Notification Template System

**Title:** Add structured notification template system to NotificationService
**Priority:** MEDIUM
**Phase:** Phase 2
**Objective:** Replace raw `body` string in `NotificationPayload` with a template-based system that supports variable substitution, per-tenant template overrides stored in KV, and multi-language support.
**Why It Matters:** Every suite currently hard-codes notification strings. A template system in core enables consistent, brandable, localisable messages across all WebWaka verticals.
**Repo Scope:** `src/core/notifications/index.ts`
**Dependencies:** KV binding for template storage
**Prerequisites:** Template naming convention
**Impacted Modules:** Notifications, all verticals sending notifications
**Likely Files/Areas to Change:**
- `src/core/notifications/index.ts` — Add `NotificationTemplate`, `renderTemplate()`, `getTemplate()`
**Expected Output:** `renderTemplate(templateId, variables, tenantId, kv)` returns rendered string
**Acceptance Criteria:**
- Default templates built-in (OTP, booking confirmation, payment receipt)
- Tenant KV override checked before default used
- `{{variable}}` syntax replaced with values
- Missing variables throw `TemplateRenderError`
**Tests Required:** Template rendering tests; missing variable error test; KV override test
**Risks:** KV read on every notification (add in-Worker cache for frequently used templates)
**Governance:** Blueprint Part 10.12 (Cross-Cutting)

---

### T025 — Unify Dual Event Systems

**Title:** Merge CommerceEvents (src/events.ts) with WebWakaEventType (src/core/events/index.ts)
**Priority:** MEDIUM
**Phase:** Phase 1
**Objective:** Eliminate the two parallel event registries. Extend `WebWakaEventType` enum with all commerce event types from `src/events.ts`. Deprecate `CommerceEvents` as a separate export.
**Why It Matters:** Two parallel event systems (`CommerceEvents` constants and `WebWakaEventType` enum) create confusion for consumers, double maintenance burden, and risk of consumers using string literals instead of typed constants.
**Repo Scope:** `src/events.ts`, `src/core/events/index.ts`, `src/index.ts`
**Dependencies:** None
**Prerequisites:** Cross-repo check that no consumer uses `CommerceEvents` in a way incompatible with enum merge
**Impacted Modules:** Events
**Likely Files/Areas to Change:**
- `src/core/events/index.ts` — Add commerce event types to `WebWakaEventType`
- `src/events.ts` — Add `@deprecated` notice; re-export from `core/events`
- `src/index.ts` — Update exports
**Expected Output:** Single unified `WebWakaEventType` enum covering all domain events
**Acceptance Criteria:**
- All `CommerceEvents` values present as `WebWakaEventType` variants
- `CommerceEvents` re-exports from `core/events` for backward compatibility
- `DomainEvent.type` constrained to the unified enum
**Tests Required:** Regression tests; event type coverage test
**Risks:** Breaking if consumers import `CommerceEventType` directly; mark as deprecated with semver minor
**Governance:** Blueprint Part 2 (Event-Driven)

---

## SECTION 7 — QA PLANS

---

### QA-T001 — BillingLedger D1 Persistence QA Plan

**What must be verified:**
- [ ] `recordUsage()` inserts exactly one row in `billing_ledger_entries` per call
- [ ] `recordCredit()` inserts exactly one row in `billing_ledger_entries` per call
- [ ] `getTenantBalance()` queries D1 and sums credits minus debits correctly
- [ ] Integer kobo enforcement — decimal amounts must throw `Error('Amount must be a positive integer in kobo')`
- [ ] `tenantId` is always bound as a SQL parameter (not string interpolated)
- [ ] D1 `run()` errors are propagated (not silently swallowed)

**Edge cases to test:**
- Balance with zero entries = 0
- Balance after credit only = credit amount
- Balance after debit only = negative (or zero if clamped — define behaviour)
- Balance after credit + debit = credit - debit
- Fractional kobo amount → validation error
- Negative amount → validation error
- Very large amount (MAX_SAFE_INTEGER) → accepted

**Regressions to detect:**
- Existing stub warning (`getTenantBalance is a stub`) should no longer be emitted
- `recordUsage()` should no longer silently return a constructed object without writing to D1

**Cross-module checks:**
- Verify AI engine (T012) billing hook writes correct `UsageCategory.AI_TOKENS`

**Deployment checks:**
- D1 binding named `DB` must be present in every Worker that uses `BillingLedger`
- Migration `001_billing_ledger.sql` must be applied to D1 before deploying

**Done for QA when:**
- All unit tests pass with D1 mock
- Balance reflects real debits and credits
- No floating point amounts accepted

---

### QA-T002 — Paystack Webhook Verification QA Plan

**What must be verified:**
- [ ] Valid HMAC-SHA512 signature → `verifyPaystackWebhook()` returns `true`
- [ ] Tampered body → returns `false`
- [ ] Wrong secret → returns `false`
- [ ] Empty signature → returns `false`
- [ ] Non-hex signature → returns `false`

**Edge cases to test:**
- UTF-8 body with special characters (accented names in Nigerian contexts)
- Very large body (>1MB webhook)
- Null/undefined signature header

**Regressions to detect:**
- Function must not throw — all error cases return `false`

**Cross-module checks:**
- Verify DVA webhook (T017) uses same verification function

**Deployment checks:**
- Paystack secret key must come from Worker environment binding, never hardcoded

**Done for QA when:**
- All fixture tests pass
- No string comparison used (constant-time via `crypto.subtle.verify`)

---

### QA-T003 — PIN Timing Attack Fix QA Plan

**What must be verified:**
- [ ] Correct PIN → `verifyPin()` returns `true`
- [ ] Wrong PIN → `verifyPin()` returns `false`
- [ ] Empty PIN → returns `false` (or defined error)
- [ ] Different-length PIN → returns `false`

**Edge cases to test:**
- PIN with leading zeros
- PIN with unicode characters
- Very long PIN (>10 chars)

**Timing safety verification:**
- Note: unit tests cannot verify timing safety. Document that `crypto.subtle.timingSafeEqual` is used and link to a timing attack reference.
- Optionally: run a timing benchmark in CI that fails if P99 latency difference between correct/wrong PIN exceeds 100ms.

**Regressions to detect:**
- `hashPin()` must still return same hash for same PIN + salt
- `verifyPin()` must still pass existing test fixtures

**Done for QA when:**
- Correct/wrong PIN tests pass
- Implementation uses ArrayBuffer comparison, not string `===`

---

### QA-T004 — KYC Provider Integration QA Plan

**What must be verified:**
- [ ] `verifyBvn()` makes HTTP call to Dojah `/api/v1/kyc/bvn` with correct headers
- [ ] `verifyNin()` makes HTTP call to correct NIN endpoint
- [ ] `verifyCac()` makes HTTP call to correct CAC endpoint
- [ ] API key sent as `Authorization: Bearer <key>` header
- [ ] Successful verification returns `{ verified: true, matchScore, provider: 'dojah' }`
- [ ] Failed verification returns `{ verified: false, reason, provider: 'dojah' }`
- [ ] HTTP error from Dojah returns `{ verified: false, reason: 'API error' }`

**Edge cases to test:**
- Dojah returns 429 (rate limit) → returns error gracefully, does not throw
- Network timeout → returns error gracefully
- Partial match (matchScore < 100) → documented threshold behaviour
- Duplicate KYC submission → handles idempotently

**Cross-module checks:**
- KYC result is persisted to D1, not in-memory
- Tenant isolation: query by `tenantId` + `userId`

**Deployment checks:**
- Dojah API key stored in KV per tenant, not hardcoded
- D1 `kyc_verifications` table migrated before deployment

**Done for QA when:**
- All mocked fetch tests pass
- No in-memory state used
- Dojah integration follows their documentation

---

### QA-T005 — Cloudflare Queues Event Bus QA Plan

**What must be verified:**
- [ ] When `env.QUEUE` is present, `emitEvent()` calls `env.QUEUE.send(event)`
- [ ] When `env.QUEUE` is absent, falls back to KV + HTTP (existing behaviour)
- [ ] Queue message body matches `WebWakaEvent<T>` schema
- [ ] Queue delivery failure is swallowed (event bus failures must not block business logic)

**Edge cases to test:**
- Queue send throws → swallowed, KV fallback attempted
- Both Queue and KV fail → swallowed, only logged
- Very large payload (>100KB) → Queue message size limit handling

**Cross-module checks:**
- All emitting modules pass `env` with QUEUE binding when available
- Consumer Workers implement `queue()` handler with correct batch processing

**Deployment checks:**
- Queue binding named `EVENTS_QUEUE` in wrangler.toml of all emitting Workers
- Dead-letter queue configured in Cloudflare dashboard

**Done for QA when:**
- Queue send called when binding present
- Fallback works when binding absent
- No blocking on queue failure

---

### QA-T006 — Durable Objects ChatEngine QA Plan

**What must be verified:**
- [ ] `createChannel()` creates a Durable Object with correct DO ID (tenant-scoped)
- [ ] `sendMessage()` persists to D1 via DO and delivers via WebSocket
- [ ] `getMessages()` queries D1 and returns paginated results
- [ ] `markAsRead()` updates D1 status rows
- [ ] WebSocket connection is properly hibernated when idle
- [ ] Re-connecting client receives missed messages from D1

**Edge cases to test:**
- Two simultaneous senders to same channel
- Sender not in participants list
- Channel not found in tenant scope
- Very long message (>10KB)
- Emoji and Unicode content in messages

**Cross-module checks:**
- Events emitted via event bus on `sendMessage`, `createChannel`
- Push notification sent to offline participants

**Deployment checks:**
- DO namespace bound in wrangler.toml as `CHAT_DO`
- D1 `chat_messages` and `chat_channels` tables migrated

**Done for QA when:**
- Messages persist across Worker restarts
- WebSocket hibernation confirmed (DO not always active)
- Tenant isolation enforced

---

### QA-T007 — BookingEngine D1 QA Plan

**What must be verified:**
- [ ] `createBooking()` inserts row in D1 `bookings` table
- [ ] `isAvailable()` queries D1 for overlapping bookings with same resourceId + tenantId
- [ ] `cancelBooking()` updates D1 row to `status = 'cancelled'`
- [ ] Conflict detection: overlapping slot for same resource → throws

**Edge cases to test:**
- Concurrent booking for same slot → at most one should succeed (D1 unique constraint or serialized check)
- Booking start = previous booking end → should be allowed (adjacent, not overlapping)
- Booking in the past → define behaviour (allow or deny)
- Cancelling an already-cancelled booking → define behaviour

**Cross-module checks:**
- Booking event emitted after create and cancel
- Notification sent to user after booking confirmation

**Deployment checks:**
- D1 `bookings` table migrated
- D1 binding `DB` present in Worker

**Done for QA when:**
- Bookings survive Worker restart
- Conflict detection works correctly
- Tenant isolation verified

---

### QA-T008 — DocumentEngine R2 + Real Signatures QA Plan

**What must be verified:**
- [ ] `createDocument()` writes to R2 with tenant-scoped key
- [ ] `signDocument()` hashes content using `crypto.subtle.digest('SHA-256', content)`
- [ ] Signature hash verifiable independently (given content, userId, IP)
- [ ] Document metadata (status, signatures) stored in D1
- [ ] Only tenant-scoped documents accessible

**Edge cases to test:**
- Document signed twice by same user → throws `'User has already signed this document'`
- Signing a draft (not `pending_signature`) → throws
- Large document (>5MB) → R2 handles without OOM
- Binary content in document → SHA-256 handles correctly

**Cross-module checks:**
- Document events emitted (`DOCUMENT_CREATED`, `DOCUMENT_SIGNED`)

**Deployment checks:**
- R2 bucket bound as `DOCUMENTS_BUCKET`
- D1 `documents` and `document_signatures` tables migrated

**Done for QA when:**
- Signature hash is reproducible from same inputs
- Documents persist in R2
- No in-memory state

---

### QA-T009 — Geolocation Real Provider QA Plan

**What must be verified:**
- [ ] OSRM provider calls `https://router.project-osrm.org/route/v1/driving/{lng},{lat};{lng},{lat}?overview=full`
- [ ] Response parsed: `routes[0].distance`, `routes[0].duration`, `routes[0].geometry`
- [ ] Fallback to Haversine when OSRM fetch fails
- [ ] Google provider calls Directions API with API key
- [ ] `isWithinGeofence()` still uses Haversine (correct behaviour)

**Edge cases to test:**
- Same origin and destination → distance = 0
- Points in ocean (OSRM returns no routes) → fallback
- Coordinates outside Nigeria bounds → provider handles or fallback
- OSRM timeout → fallback to Haversine

**Cross-module checks:**
- Transport/logistics suites receive real polylines

**Deployment checks:**
- OSRM is public (no key needed); Google Maps key in Worker KV if using Google

**Done for QA when:**
- Real distances returned for Lagos → Abuja (should be ~700km by road, not ~570km straight-line)
- Fallback works when provider fails

---

### QA-T010 — JWT RS256 Support QA Plan

**What must be verified:**
- [ ] `signJWT(payload, privateKey, { algorithm: 'RS256' })` produces valid RS256 JWT
- [ ] `verifyJWT(token, publicKey, { algorithm: 'RS256' })` verifies and decodes correctly
- [ ] Tampered token returns `null`
- [ ] Expired token returns `null`
- [ ] HS256 (existing) still works unchanged

**Edge cases to test:**
- RS256 token verified with wrong public key → `null`
- RS256 token verified with private key (not public) → `null`
- Unicode payload (accented names, Arabic) → round-trips correctly

**Regressions to detect:**
- All existing HS256 tests must pass unchanged

**Done for QA when:**
- RS256 sign/verify round-trip passes
- HS256 regression tests pass

---

### QA-T011 — Flutterwave Provider QA Plan

**What must be verified:**
- [ ] `verifyCharge(reference)` calls Flutterwave `/v3/transactions/{id}/verify`
- [ ] `initiateRefund(reference, amountKobo)` calls Flutterwave refund endpoint
- [ ] `initiateTransfer()` calls Flutterwave transfer endpoint
- [ ] Webhook signature verified with `verifyFlutterwaveWebhook()`

**Edge cases to test:**
- Reference not found → `{ success: false }`
- Amount in response is in kobo (Flutterwave uses kobo internally — verify)
- Network error → returns error gracefully

**Done for QA when:**
- All four `IPaymentProvider` methods implemented and tested
- Webhook verification working

---

### QA-T012 — AI Billing Integration QA Plan

**What must be verified:**
- [ ] After every successful `AIEngine.execute()`, `BillingLedger.recordUsage()` is called
- [ ] Token count extracted from OpenRouter `usage.total_tokens`
- [ ] Billing failure (D1 error) does NOT cause AI call to fail
- [ ] CF AI fallback (no token count) records 0 tokens or estimated tokens

**Edge cases to test:**
- OpenRouter returns no `usage` field → billing records 0 tokens (or skips)
- D1 write fails → AI response still returned to caller
- Tenant has zero remaining balance → define behaviour (soft or hard limit)

**Done for QA when:**
- Billing debit recorded on every successful AI completion
- AI calls not blocked by billing failures

---

### QA-T013 — RBAC Cleanup QA Plan

**What must be verified:**
- [ ] `verifyJwt` no longer exported from `@webwaka/core/rbac`
- [ ] `requireRole` reads from `c.get('user')` not `c.get('session')`
- [ ] `requirePermissions` reads from `c.get('user')` not `c.get('session')`
- [ ] SUPER_ADMIN bypass still works in `requirePermissions`

**Regressions to detect:**
- Any consumer of `rbac.verifyJwt` will get a compile error → this is intentional
- Tests using `c.get('session')` must be updated

**Done for QA when:**
- All RBAC tests pass with the `'user'` context key
- `verifyJwt` absent from module exports

---

### QA-T014 — Input Validation QA Plan

**What must be verified:**
- [ ] `recordUsage(tenantId, category, 1.5, ...)` throws `ValidationError`
- [ ] `sendOTP('not-a-phone-number', ...)` throws `ValidationError`
- [ ] `verifyBvn('not-a-bvn', ...)` throws `ValidationError`
- [ ] Valid inputs pass through and function normally

**Edge cases to test:**
- Boundary values (0 kobo, MAX_SAFE_INTEGER kobo)
- Phone number formats: `+2348012345678`, `08012345678`, `2348012345678` (E.164 vs local)
- Empty strings vs null vs undefined

**Done for QA when:**
- Invalid inputs throw `ValidationError` with descriptive message
- Valid inputs unchanged

---

### QA-T015 — NDPA Compliance QA Plan

**What must be verified:**
- [ ] `assertNdpaConsent(body)` passes when `ndpr_consent: true` AND `lawful_basis` is a valid value
- [ ] Fails when `ndpr_consent: false`
- [ ] Fails when `lawful_basis` is missing or invalid
- [ ] `recordConsentWithdrawal()` inserts withdrawal record in D1
- [ ] `getConsentsForEntity()` returns paginated history

**Regulatory checks:**
- Verify all six NDPA lawful bases are represented in enum
- Verify consent withdrawal is timestamped correctly
- Verify consent records retained for minimum 3 years (TTL not set or set to 3 years)

**Done for QA when:**
- All consent functions tested
- NDPA 2023 lawful bases covered

---

### QA-T016 — Push Notification QA Plan

**What must be verified:**
- [ ] FCM path: `Authorization: key=<serverKey>` header sent
- [ ] Expo path: `Content-Type: application/json`, correct Expo Push API URL
- [ ] Network failure → returns `false`, does not throw
- [ ] Invalid/expired push token → returns `false`, logs error

**Done for QA when:**
- Both FCM and Expo paths tested with mocked fetch
- No throw on failure

---

### QA-T017 — Paystack DVA QA Plan

**What must be verified:**
- [ ] `createVirtualAccount(customerId, preferredBank)` calls Paystack DVA API
- [ ] Returns `{ accountNumber, bankName, bankCode }` on success
- [ ] DVA webhook verified with `verifyPaystackWebhook()`

**Done for QA when:**
- DVA creation tested with mocked Paystack response
- Webhook verification tested

---

### QA-T018 — AI Caching QA Plan

**What must be verified:**
- [ ] Cache hit: KV get returns cached value → API not called
- [ ] Cache miss: API called → result stored in KV with TTL
- [ ] Cache key is deterministic for same model + prompt
- [ ] Cache disabled (no kv provided) → no KV calls

**Done for QA when:**
- Cache hit/miss/disabled paths tested
- KV key reproducibility tested

---

### QA-T019 — Nanoid Fix + ULID QA Plan

**What must be verified:**
- [ ] `nanoid()` generates IDs of correct length
- [ ] `nanoid()` uses only CHARS alphabet
- [ ] `generateUlid()` returns 26-character string
- [ ] `generateUlid()` output is lexicographically sortable by creation time
- [ ] Modulo bias: statistical test shows character distribution within ±2% of uniform

**Done for QA when:**
- ULID format and sort order tested
- Nanoid bias test passes

---

### QA-T020 — CI/CD Hardening QA Plan

**What must be verified:**
- [ ] `npm audit --audit-level=high` runs in CI
- [ ] `size-limit` check runs and fails if bundle exceeds threshold
- [ ] `pnpm publish --provenance` used in publish job
- [ ] Commitlint runs on PR commits

**Regressions to detect:**
- CI must still pass for valid conventional commits
- CI must still publish on version bump

**Done for QA when:**
- CI passes with conventional commit
- CI fails with `fix: bad` (audit finds vulnerability injected for test)

---

### QA-T021 — Webhook Library Expansion QA Plan

**What must be verified:**
- [ ] Flutterwave HMAC-SHA256 verification correct
- [ ] Termii delivery report verification correct
- [ ] Yournotify delivery callback verification correct

**Done for QA when:**
- Good/bad fixtures pass for each provider

---

### QA-T022 — Bank Account Resolution QA Plan

**What must be verified:**
- [ ] `/bank/resolve` called with correct `account_number` and `bank_code` query params
- [ ] Account name returned correctly
- [ ] Non-existent account → defined error response

**Done for QA when:**
- Mocked fetch tests pass for success and failure cases

---

### QA-T023 — CBN KYC Tier QA Plan

**What must be verified:**
- [ ] User with no verifications → Tier 1
- [ ] User with verified NIN → Tier 2
- [ ] User with verified BVN + NIN → Tier 3
- [ ] Limits returned in kobo (not naira)
- [ ] Tenant isolation enforced

**Done for QA when:**
- All three tier determinations correct
- Limits match current CBN guidelines

---

### QA-T024 — Notification Templates QA Plan

**What must be verified:**
- [ ] `renderTemplate('otp', { otp: '123456' })` replaces `{{otp}}` correctly
- [ ] Missing variable throws `TemplateRenderError`
- [ ] Tenant KV override checked before default
- [ ] Default templates for OTP, booking, payment exist

**Done for QA when:**
- Template rendering correct
- KV override works
- Missing variable error thrown

---

### QA-T025 — Event Unification QA Plan

**What must be verified:**
- [ ] All `CommerceEvents` values present in `WebWakaEventType`
- [ ] `CommerceEvents` re-exports from `core/events` (backward compatible)
- [ ] `WebWakaEventType.INVENTORY_UPDATED` === `'inventory.updated'`
- [ ] No duplicate event type values in the enum
- [ ] `DomainEvent.type` constrained to unified enum

**Done for QA when:**
- All event values present and correct
- No duplicate values
- Backward compatibility preserved

---

## SECTION 8 — IMPLEMENTATION PROMPTS

---

### IMPL-T001 — BillingLedger D1 Persistence

```
IMPLEMENTATION PROMPT — T001: Wire BillingLedger D1 Persistence
Repo: @webwaka/core (https://github.com/WebWakaDOS/webwaka-core)
Runtime: Cloudflare Workers (ESM, Web Crypto only — no Node.js APIs)
Framework: Hono ≥4.0.0
Package Manager: pnpm

ECOSYSTEM CAVEAT: This repo is NOT a standalone application. It is a shared library consumed
by all WebWaka vertical suites. Any breaking change requires a semver major bump and
coordination with all consumers. This task is additive only — do not change existing method signatures.

OBJECTIVE: Implement real D1 database persistence for BillingLedger. Replace the stub
getTenantBalance() (always returns 0) and the no-op recordUsage()/recordCredit()
(which construct objects but never write to D1) with real D1 SQL operations.

CONSULT BEFORE ACTING:
- Read src/core/billing/index.ts fully (existing stubs and commented SQL)
- Read src/index.ts (export map)
- Read CHANGELOG.md (version history)
- Read docs/PHASE_1_COMPLETION_REPORT.md (context)
- Read replit.md (project context)

IMPORTANT REMINDERS:
- ALL monetary amounts MUST be integer kobo. Never float. Never naira.
- tenantId MUST be a bound SQL parameter, never string-interpolated into SQL.
- D1 errors must be propagated (not silently swallowed).
- All amounts must be validated: must be positive integer kobo.
- Do NOT change existing method signatures.
- Do NOT use console.log — use the platform logger at src/core/logger/index.ts.
- This is a Cloudflare Workers library — D1Database type comes from @cloudflare/workers-types.
- Constructor must accept D1Database as typed parameter (not any).

DELIVERABLES:
1. Updated src/core/billing/index.ts:
   - BillingLedger constructor accepts D1Database (typed, not any)
   - recordUsage() inserts into D1 billing_ledger_entries table
   - recordCredit() inserts into D1 billing_ledger_entries table
   - getTenantBalance() queries D1 and returns real balance (credits - debits)
   - All methods validate amountKobo is a positive integer
2. New file: docs/migrations/001_billing_ledger.sql with CREATE TABLE statement
3. Updated tests: src/core/billing/index.test.ts covering real D1 operations via mock

ACCEPTANCE CRITERIA:
- recordUsage() and recordCredit() insert rows in D1
- getTenantBalance() returns correct sum from D1
- Fractional or negative kobo throws Error
- The stub warning log is removed
- All existing tests pass
- New D1 mock tests pass

DO NOT SKIP OR SHORTCUT:
- Do not leave D1 SQL commented out
- Do not return hardcoded values
- Do not use any type for D1Database
```

---

### IMPL-T002 — Paystack Webhook Verification

```
IMPLEMENTATION PROMPT — T002: Paystack Webhook HMAC-SHA512 Verification
Repo: @webwaka/core (https://github.com/WebWakaDOS/webwaka-core)
Runtime: Cloudflare Workers (Web Crypto API only)

ECOSYSTEM CAVEAT: This is a shared library. verifyPaystackWebhook must be
importable by any WebWaka vertical Worker that receives Paystack webhooks.

OBJECTIVE: Add verifyPaystackWebhook(rawBody: string, signature: string, secretKey: string): Promise<boolean>
to src/payment.ts using Web Crypto HMAC-SHA512 verification.

CONSULT BEFORE ACTING:
- Read src/payment.ts (existing PaystackProvider implementation)
- Read src/index.ts (export map)
- Paystack webhook documentation: https://paystack.com/docs/payments/webhooks

IMPORTANT REMINDERS:
- Use crypto.subtle.sign('HMAC', key, data) with SHA-512 hash algorithm.
- NEVER use string equality (===) for signature comparison — use crypto.subtle.verify or
  encode both as Uint8Array and compare via timingSafeEqual approach.
- The function must NEVER throw — return false on any error.
- The secret key must come from constructor parameter, never hardcoded.
- Export from both src/payment.ts AND src/index.ts.

DELIVERABLES:
1. verifyPaystackWebhook(rawBody, signature, secretKey): Promise<boolean> in src/payment.ts
2. Updated src/index.ts to export verifyPaystackWebhook
3. Tests in src/payment.test.ts: valid signature → true; tampered body → false; wrong key → false

ACCEPTANCE CRITERIA:
- Valid Paystack webhook signature returns true
- Any tampering returns false
- Function never throws
- Uses Web Crypto HMAC-SHA512 (not SHA-256)
```

---

### IMPL-T003 — Constant-Time PIN Comparison

```
IMPLEMENTATION PROMPT — T003: Fix Timing Attack in verifyPin
Repo: @webwaka/core (https://github.com/WebWakaDOS/webwaka-core)
Runtime: Cloudflare Workers (Web Crypto API)

OBJECTIVE: Replace string equality (===) in verifyPin() with constant-time comparison.

CONSULT BEFORE ACTING:
- Read src/pin.ts (existing implementation)
- Read src/pin.test.ts (existing tests)

IMPORTANT REMINDERS:
- Cloudflare Workers runtime has crypto.subtle available natively.
- Encode both hash strings as Uint8Array using TextEncoder before comparison.
- Use a loop-based constant-time comparison or convert to ArrayBuffer and compare byte-by-byte
  in constant time (ensure early exit is eliminated by comparing all bytes regardless).
- Alternative: derive both hashes as ArrayBuffer and use crypto.subtle.verify with HMAC
  trick (hash both with same key, compare HMAC outputs — this is timing safe by design).
- All existing tests in src/pin.test.ts MUST still pass.

DELIVERABLES:
1. Updated src/pin.ts with constant-time comparison in verifyPin()
2. Comment explaining why constant-time comparison is used and what attack it prevents

ACCEPTANCE CRITERIA:
- Correct PIN → true
- Wrong PIN → false
- Comparison does not short-circuit on first mismatched character
- All existing tests pass
```

---

### IMPL-T004 — Real KYC Provider (Dojah)

```
IMPLEMENTATION PROMPT — T004: Implement DojahKycProvider
Repo: @webwaka/core (https://github.com/WebWakaDOS/webwaka-core)
Runtime: Cloudflare Workers

ECOSYSTEM CAVEAT: KYC is used by Fintech, Transport, and potentially all WebWaka verticals.
API keys MUST come from KV/constructor parameters — never hardcoded.

OBJECTIVE: Implement DojahKycProvider class implementing IKycProvider from src/kyc.ts.
This replaces the mockExternalVerification() in KYCEngine with real Dojah API calls.

CONSULT BEFORE ACTING:
- Read src/kyc.ts (IKycProvider interface)
- Read src/core/kyc/index.ts (KYCEngine mock implementation)
- Read src/index.ts (exports)
- Dojah API docs: https://docs.dojah.io

IMPORTANT REMINDERS:
- API key passed in constructor, never hardcoded.
- All fetch calls must handle network errors gracefully (return error result, do not throw).
- BVN and NIN are sensitive — never log the raw numbers; log a masked version at most.
- IKycProvider defines: verifyBvn(bvnHash, firstName, lastName, dob), verifyNin(ninHash, firstName, lastName), verifyCac(rcNumber, businessName).
- bvnHash/ninHash — document whether you send the hash or the raw number to Dojah.
- Return KycVerificationResult: { verified, matchScore?, reason?, provider }.

DELIVERABLES:
1. DojahKycProvider class in src/kyc.ts implementing IKycProvider
2. createDojahKycProvider(apiKey: string): IKycProvider factory function
3. Export from src/index.ts
4. Tests in src/kyc.test.ts with mocked fetch for all three verification types
5. Updated src/core/kyc/index.ts KYCEngine to accept optional IKycProvider instead of mockExternalVerification

ACCEPTANCE CRITERIA:
- verifyBvn() calls Dojah BVN endpoint with correct headers
- verifyNin() calls Dojah NIN endpoint
- verifyCac() calls Dojah CAC endpoint
- All return KycVerificationResult
- API errors return { verified: false, reason: 'API error', provider: 'dojah' }
- No hardcoded API keys
```

---

### IMPL-T005 — Cloudflare Queues Event Bus

```
IMPLEMENTATION PROMPT — T005: Cloudflare Queues Integration for emitEvent
Repo: @webwaka/core (https://github.com/WebWakaDOS/webwaka-core)
Runtime: Cloudflare Workers

ECOSYSTEM CAVEAT: emitEvent is called by every WebWaka vertical suite. The change must be
backward compatible — existing callers without a Queue binding must continue to work.

OBJECTIVE: Extend emitEvent() in src/core/events/index.ts to support Cloudflare Queue delivery
as the primary path, with KV + HTTP as fallback.

CONSULT BEFORE ACTING:
- Read src/core/events/index.ts (existing emitEvent + EventBusEnv)
- Read @cloudflare/workers-types Queue type definition

IMPORTANT REMINDERS:
- Queue binding is optional — not all Workers will have it in Phase 2.
- EventBusEnv interface must add optional QUEUE?: Queue<WebWakaEvent>.
- emitEvent must NEVER throw — swallow all queue/KV/HTTP errors.
- Queue message body must be JSON-serialisable WebWakaEvent<T>.
- KV + HTTP fallback must still work when QUEUE is absent.

DELIVERABLES:
1. Updated EventBusEnv interface with optional QUEUE?: Queue
2. Updated emitEvent() to call env.QUEUE.send(event) when Queue binding present
3. Fallback to KV + HTTP when Queue absent
4. Updated tests covering Queue path and fallback path

ACCEPTANCE CRITERIA:
- Queue.send() called when env.QUEUE present
- KV fallback used when Queue absent
- All existing tests still pass
- emitEvent never throws
```

---

### IMPL-T013 — RBAC Cleanup

```
IMPLEMENTATION PROMPT — T013: Clean Up src/core/rbac/index.ts
Repo: @webwaka/core (https://github.com/WebWakaDOS/webwaka-core)

OBJECTIVE: Remove mock verifyJwt() and fix context key mismatch in RBAC module.

CONSULT BEFORE ACTING:
- Read src/core/rbac/index.ts (full file)
- Read src/core/auth/index.ts (the replacement module)
- Read CHANGELOG.md (deprecation history)

IMPORTANT REMINDERS:
- requireRole and requirePermissions in RBAC use c.get('session') — auth module uses c.get('user').
- These must be updated to c.get('user') for compatibility.
- verifyJwt() is a mock that returns hardcoded sessions — it must be removed.
- Add @deprecated JSDoc to all exports in src/core/rbac/index.ts directing consumers to src/core/auth/index.ts.
- This is a breaking change for consumers using rbac.verifyJwt — document in CHANGELOG.
- This requires a semver minor bump (or major if removing verifyJwt is considered breaking).

DELIVERABLES:
1. src/core/rbac/index.ts — verifyJwt removed; requireRole and requirePermissions use 'user' key
2. @deprecated JSDoc on all RBAC exports
3. Updated src/core/rbac/index.test.ts
4. CHANGELOG.md entry for this change
5. Version bump in package.json

ACCEPTANCE CRITERIA:
- verifyJwt no longer exported
- requireRole reads c.get('user')
- requirePermissions reads c.get('user')
- All RBAC tests pass
```

---

### IMPL-T015 — NDPA Compliance Update

```
IMPLEMENTATION PROMPT — T015: Update src/ndpr.ts to NDPA 2023 / GAID 2025 Compliance
Repo: @webwaka/core (https://github.com/WebWakaDOS/webwaka-core)
Runtime: Cloudflare Workers

ECOSYSTEM CAVEAT: NDPA compliance is a legal requirement for all WebWaka suites processing
personal data of Nigerian data subjects.

OBJECTIVE: Update src/ndpr.ts to reflect NDPA 2023 and GAID 2025.
Add: LawfulBasis enum, assertNdpaConsent(), recordConsentWithdrawal(), getConsentsForEntity().
Rename assertNdprConsent() to assertNdpaConsent() with backward alias for assertNdprConsent.

CONSULT BEFORE ACTING:
- Read src/ndpr.ts (current implementation)
- Read NDPA 2023 summary — six lawful bases: consent, contract, legal obligation, vital interests, public task, legitimate interests.
- Read GAID 2025 effective September 2025.

IMPORTANT REMINDERS:
- assertNdprConsent must still work (add alias) for backward compatibility.
- assertNdpaConsent validates both ndpr_consent: true AND lawful_basis is valid LawfulBasis.
- recordConsentWithdrawal inserts into ndpr_consent_withdrawal_log D1 table.
- getConsentsForEntity returns paginated NdprConsentLog[] from D1.
- All D1 operations use bound parameters, not string interpolation.
- Do NOT use console.log — use the platform logger.

DELIVERABLES:
1. Updated src/ndpr.ts with LawfulBasis enum, assertNdpaConsent, recordConsentWithdrawal, getConsentsForEntity
2. assertNdprConsent kept as alias for backward compatibility
3. docs/migrations/003_ndpa_consent.sql with withdrawal log table
4. Updated src/ndpr.test.ts covering all new functions
5. Updated src/index.ts exports

ACCEPTANCE CRITERIA:
- assertNdpaConsent passes with valid lawful_basis
- assertNdpaConsent fails without lawful_basis
- recordConsentWithdrawal inserts withdrawal record
- All new functions tested
- assertNdprConsent backward alias still works
```

---

### IMPL-T019 — Nanoid Fix + ULID

```
IMPLEMENTATION PROMPT — T019: Fix Nanoid Modulo Bias + Add ULID Generation
Repo: @webwaka/core (https://github.com/WebWakaDOS/webwaka-core)
Runtime: Cloudflare Workers

OBJECTIVE: Fix the modulo bias in nanoid() and add a generateUlid() function.

CONSULT BEFORE ACTING:
- Read src/nanoid.ts (current implementation)
- Read src/nanoid.test.ts (existing tests)

IMPORTANT REMINDERS:
- Fix modulo bias using rejection sampling: discard bytes >= floor(256/62)*62 = 248.
  That is, discard bytes 248-255 (8 out of 256 = 3.125% rejection rate, acceptable).
- generateUlid() must produce 26-character Crockford Base32 encoded IDs.
- ULID format: 10 chars (48-bit timestamp in ms) + 16 chars (80-bit random).
- ULIDs must be lexicographically sortable by creation time.
- All existing nanoid tests must still pass.
- genId alias must still work.

DELIVERABLES:
1. Updated src/nanoid.ts with rejection sampling in nanoid() and new generateUlid()
2. Exported generateUlid from src/nanoid.ts and src/index.ts
3. Updated tests in src/nanoid.test.ts covering ULID format, sort order, nanoid uniformity

ACCEPTANCE CRITERIA:
- generateUlid() returns 26-char string
- Two sequential ULIDs are lexicographically ordered (earlier first)
- nanoid() uses rejection sampling (no bytes >= 248 used)
- All existing tests pass
```

---

### IMPL-T020 — CI/CD Hardening

```
IMPLEMENTATION PROMPT — T020: Harden CI/CD Pipeline
Repo: @webwaka/core (https://github.com/WebWakaDOS/webwaka-core)

OBJECTIVE: Add security scanning, bundle size enforcement, npm provenance, and commitlint
to the GitHub Actions workflow.

CONSULT BEFORE ACTING:
- Read .github/workflows/publish.yml (current CI/CD)
- Read package.json (scripts and devDependencies)

IMPORTANT REMINDERS:
- All new CI steps run as part of the existing 'test' job (before publish).
- npm audit level: high (fail on high or critical vulnerabilities only).
- size-limit: configure in package.json with a 100KB max (adjust after measuring actual size).
- pnpm publish --provenance requires GitHub Actions OIDC permissions (already set: id-token: write).
- commitlint: use @commitlint/config-conventional with 'feat', 'fix', 'chore', 'docs', 'test', 'refactor'.
- Do not break existing test and publish jobs.

DELIVERABLES:
1. Updated .github/workflows/publish.yml with audit, size-limit, provenance steps
2. Updated package.json: add size-limit config, commitlint config, new devDependencies
3. .commitlintrc.json at repo root
4. .size-limit.json or size-limit config in package.json

ACCEPTANCE CRITERIA:
- CI runs npm audit --audit-level=high
- CI runs size-limit check
- pnpm publish --provenance used in publish step
- Commitlint configured
- All existing CI steps still pass
```

---

### IMPL-T025 — Unify Event Systems

```
IMPLEMENTATION PROMPT — T025: Merge CommerceEvents into WebWakaEventType
Repo: @webwaka/core (https://github.com/WebWakaDOS/webwaka-core)

ECOSYSTEM CAVEAT: Consumers may currently import CommerceEvents directly.
This must remain a backward-compatible change — CommerceEvents must still export.

OBJECTIVE: Add all CommerceEvents values to WebWakaEventType enum.
Deprecate CommerceEvents as a separate object; re-export from core/events for compat.

CONSULT BEFORE ACTING:
- Read src/events.ts (CommerceEvents object)
- Read src/core/events/index.ts (WebWakaEventType enum)
- Read src/index.ts (exports)

IMPORTANT REMINDERS:
- Add new WebWakaEventType variants for all commerce events from src/events.ts.
- Use the same string values (e.g., WebWakaEventType.INVENTORY_UPDATED = 'inventory.updated').
- Keep src/events.ts but add @deprecated to CommerceEvents and re-map to WebWakaEventType values.
- Verify no duplicate string values in the unified enum.
- Update DomainEvent.type to accept the wider enum.
- This is a non-breaking additive change (new enum values + backward alias).

DELIVERABLES:
1. Updated src/core/events/index.ts with all CommerceEvents added to WebWakaEventType
2. Updated src/events.ts with @deprecated + re-export mapping
3. Updated src/index.ts if needed
4. Updated tests verifying all event string values are correct
5. No duplicate enum values

ACCEPTANCE CRITERIA:
- WebWakaEventType.INVENTORY_UPDATED === 'inventory.updated'
- All original CommerceEvents values accessible via WebWakaEventType
- CommerceEvents still importable (re-export for compat)
- No duplicate string values in enum
```

---

## SECTION 9 — QA PROMPTS

---

### QA-PROMPT-T001 — BillingLedger D1 QA Execution

```
QA PROMPT — T001: BillingLedger D1 Persistence QA Verification
Repo: @webwaka/core (https://github.com/WebWakaDOS/webwaka-core)

ECOSYSTEM CAVEAT: This is a shared library. Any regression in BillingLedger will affect
every WebWaka vertical suite that uses billing. Test thoroughly before approving.

OBJECTIVE: Verify that T001 implementation is correct, complete, and production-ready.

CONSULT BEFORE ACTING:
- Read src/core/billing/index.ts (post-implementation)
- Read src/core/billing/index.test.ts (updated tests)
- Read docs/migrations/001_billing_ledger.sql (schema)
- Run: pnpm run test --reporter=verbose (check all billing tests pass)
- Run: pnpm run lint (type-check)

VERIFY EACH ITEM:
1. recordUsage() — confirm D1 INSERT SQL is correct:
   - All columns bound as parameters (no string interpolation)
   - amountKobo stored as INTEGER (not REAL or TEXT)
   - id uses crypto.randomUUID() or nanoid
   - tenantId is a bound parameter
2. recordCredit() — same verification as above
3. getTenantBalance() — confirm:
   - SUM(CASE WHEN type = 'CREDIT' THEN amountKobo ELSE -amountKobo END) AS balance
   - Filters by tenantId AND deletedAt IS NULL
   - Returns 0 when no rows found
4. Validation — confirm amountKobo = 1.5 throws Error before any DB call
5. Logger — confirm stub warning no longer emitted

BUG PATTERNS TO LOOK FOR:
- float division in balance calculation
- tenantId not in WHERE clause (cross-tenant data leak)
- D1 errors silently swallowed
- stub warning still emitted when D1 integration is live

EDGE CASE TESTS TO RUN MANUALLY:
- Balance with no entries: expect 0
- Balance after 1 credit (50000 kobo): expect 50000
- Balance after 1 credit (50000) + 1 debit (20000): expect 30000
- recordUsage with amountKobo = 1.5: expect throw

DONE WHEN:
- All billing tests pass
- D1 writes confirmed in test mock
- No stub warning in logs
- Balance math verified correct
```

---

### QA-PROMPT-T002 — Paystack Webhook QA Execution

```
QA PROMPT — T002: Paystack Webhook Verification QA
Repo: @webwaka/core

OBJECTIVE: Verify verifyPaystackWebhook() is correctly implemented and secure.

CONSULT BEFORE ACTING:
- Read src/payment.ts (post-implementation)
- Read src/payment.test.ts
- Run: pnpm run test

VERIFY EACH ITEM:
1. HMAC algorithm is SHA-512 (not SHA-256 — Paystack uses SHA-512)
2. Comparison is constant-time (uses crypto.subtle.verify or equivalent, not ===)
3. Function returns false (not throw) on invalid hex signature
4. Function returns false on empty body
5. Function is exported from src/index.ts

TEST FIXTURES TO VERIFY:
- Generate a known HMAC-SHA512 of 'test-body' with key 'test-secret'
- Confirm function returns true for matching signature
- Tamper one byte in body → confirm returns false
- Use wrong key → confirm returns false

DONE WHEN:
- All payment tests pass
- Algorithm verified as SHA-512
- No throw on error — always false
```

---

### QA-PROMPT-T003 — PIN Timing Attack Fix QA

```
QA PROMPT — T003: PIN Timing Attack Fix QA
Repo: @webwaka/core

OBJECTIVE: Verify that verifyPin() uses constant-time comparison.

CONSULT BEFORE ACTING:
- Read src/pin.ts (post-implementation)
- Run: pnpm run test

VERIFY EACH ITEM:
1. Implementation does NOT use hash === storedHash (string equality)
2. Implementation uses ArrayBuffer or Uint8Array comparison
3. Correct PIN returns true
4. Wrong PIN returns false
5. All existing pin tests pass

DOCUMENT:
- The method of constant-time comparison used
- Why it prevents timing attacks

DONE WHEN:
- No === string comparison on hash values
- All pin tests pass
- Implementation documented
```

---

### QA-PROMPT-T013 — RBAC Cleanup QA

```
QA PROMPT — T013: RBAC Module Cleanup QA
Repo: @webwaka/core

OBJECTIVE: Verify verifyJwt is removed and context key fixed to 'user'.

CONSULT BEFORE ACTING:
- Read src/core/rbac/index.ts (post-implementation)
- Run: pnpm run test

VERIFY EACH ITEM:
1. verifyJwt is NOT exported from src/core/rbac/index.ts
2. requireRole reads c.get('user') not c.get('session')
3. requirePermissions reads c.get('user') not c.get('session')
4. @deprecated JSDoc present on RBAC exports
5. All rbac tests pass with 'user' context key
6. CHANGELOG.md updated

DONE WHEN:
- verifyJwt absent
- Context key is 'user'
- All tests pass
```

---

### QA-PROMPT-T019 — Nanoid + ULID QA

```
QA PROMPT — T019: Nanoid Fix + ULID QA
Repo: @webwaka/core

OBJECTIVE: Verify modulo bias fixed and ULID works correctly.

CONSULT BEFORE ACTING:
- Read src/nanoid.ts (post-implementation)
- Run: pnpm run test

VERIFY EACH ITEM:
1. nanoid() does NOT use bytes >= 248 (rejection sampling present)
2. generateUlid() returns 26-character string
3. Two ULIDs generated 1ms apart are lexicographically ordered (earlier < later)
4. All existing nanoid tests pass

STATISTICAL CHECK:
- Generate 10,000 nanoids
- Count frequency of each character
- Verify no character appears more than 1.05× average frequency

DONE WHEN:
- ULID format and sort order tests pass
- Rejection sampling confirmed in code
- Statistical distribution acceptable
```

---

### QA-PROMPT-T020 — CI/CD Hardening QA

```
QA PROMPT — T020: CI/CD Hardening QA
Repo: @webwaka/core

OBJECTIVE: Verify CI/CD hardening steps are correctly configured.

CONSULT BEFORE ACTING:
- Read .github/workflows/publish.yml (post-implementation)
- Read package.json (size-limit and commitlint config)

VERIFY EACH ITEM:
1. npm audit --audit-level=high step present in test job
2. size-limit step runs pnpm build then checks bundle size
3. pnpm publish --provenance used in publish step
4. id-token: write permission in publish job (required for provenance OIDC)
5. commitlint configuration file exists

DONE WHEN:
- All CI steps pass on a clean push
- size-limit fails if a 1MB file is added to src (test locally)
- audit step passes with current dependencies
```

---

## SECTION 10 — PRIORITY ORDER

### Tier 1 — CRITICAL (Do First)

| Task | Why Critical |
|---|---|
| T001 — BillingLedger D1 | Balance always 0 allows unlimited free usage |
| BF-003 — Billing no-op writes | D1 writes are commented out |
| T003 — PIN timing attack | Security vulnerability |
| T002 — Paystack webhook | Fraud vector if webhooks not verified |
| T013 — RBAC cleanup | Mock verifyJwt is a security risk |
| T015 — NDPA compliance | Regulatory non-compliance |

### Tier 2 — HIGH (Do Next)

| Task | Why High |
|---|---|
| T004 — KYC provider | No real KYC = fintech suites blocked |
| T007 — Booking D1 | Data loss on every Worker restart |
| T009 — Geo routing | Mock polylines unusable by any frontend |
| T022 — Bank account resolution | Required before any transfer |
| T023 — CBN KYC tiers | Required by CBN for Nigerian fintech |
| T020 — CI/CD hardening | Supply chain security |
| T025 — Event unification | Eliminates confusion from dual event systems |
| T019 — Nanoid fix + ULID | Sortable IDs needed for D1 queries |

### Tier 3 — MEDIUM (Phase 2)

| Task | Why Medium |
|---|---|
| T005 — Cloudflare Queues | Improves event reliability |
| T006 — DO ChatEngine | Real-time chat impossible without it |
| T008 — R2 DocumentEngine | Documents currently not persisted |
| T010 — JWT RS256 | Improves multi-service security posture |
| T011 — Flutterwave | Vendor diversity for payments |
| T012 — AI billing | Token cost tracking |
| T014 — Input validation | Correctness improvement |
| T016 — Push notifications | Mock currently does nothing |
| T017 — Paystack DVA | Major Nigerian collection pattern |
| T021 — Webhook expansion | Complete webhook security |
| T024 — Notification templates | DX improvement for suite builders |

### Tier 4 — LOW (Improvement)

| Task | Why Low |
|---|---|
| T018 — AI caching | Cost optimization |

---

## SECTION 11 — DEPENDENCY MAP

```
T001 (Billing D1) ← T012 (AI billing) depends on T001
T002 (Paystack webhook) ← T017 (DVA) depends on T002
T002 ← T021 (webhook expansion) depends on T002
T004 (KYC real) ← T023 (CBN tiers) depends on T004
T004 ← T007 (Booking D1) — independent
T007 (Booking D1) — independent
T013 (RBAC cleanup) — independent (safe to do anytime)
T015 (NDPA) — independent
T019 (Nanoid) — independent
T025 (Event unification) — independent
T005 (Queues) ← T006 (DO Chat) may use T005
T006 (DO Chat) ← T008 (R2 Docs) — independent
T010 (JWT RS256) — independent
T011 (Flutterwave) ← T021 (webhook expansion) depends on T011
T020 (CI/CD) — independent (can run anytime)
```

---

## SECTION 12 — PHASE 1 / PHASE 2 SPLIT

### Phase 1 — Foundation Fixes (Weeks 1–4)

These tasks fix critical gaps that block production usage:

| Task | Target |
|---|---|
| T001 | BillingLedger D1 persistence |
| T002 | Paystack webhook verification |
| T003 | PIN timing attack fix |
| T013 | RBAC mock cleanup |
| T015 | NDPA compliance update |
| T019 | Nanoid fix + ULID |
| T020 | CI/CD hardening |
| T022 | Bank account resolution |
| T025 | Event system unification |
| T007 | Booking D1 persistence |
| T009 (OSM only) | Geolocation OSRM integration |

### Phase 2 — Enhancement & Integration (Weeks 5–12)

These tasks add real integrations and advanced capabilities:

| Task | Target |
|---|---|
| T004 | Real KYC (Dojah) |
| T005 | Cloudflare Queues event bus |
| T006 | Durable Objects chat |
| T008 | R2 document engine |
| T009 (Google/Mapbox) | Full geolocation providers |
| T010 | JWT RS256/EdDSA |
| T011 | Flutterwave provider |
| T012 | AI billing integration |
| T014 | Input validation (Valibot) |
| T016 | Push notifications (FCM/Expo) |
| T017 | Paystack DVA |
| T018 | AI semantic caching |
| T021 | Webhook library expansion |
| T023 | CBN KYC tier enforcement |
| T024 | Notification template system |

---

## SECTION 13 — REPO CONTEXT AND ECOSYSTEM NOTES

### 13.1 What This Repo Contains

`@webwaka/core` contains the **shared platform primitives** for WebWaka OS v4. It is published to npm as a scoped package and imported by all vertical Workers.

### 13.2 What This Repo Does NOT Contain

The following capabilities intentionally live in other WebWaka repos:

| Capability | Lives In |
|---|---|
| Super Admin UI | `webwaka-super-admin-v2` |
| Tenant management API | `webwaka-super-admin-v2` or platform API Worker |
| Frontend applications | Separate repos per vertical |
| D1 schema migrations (full) | Each vertical's repo manages its own migrations |
| Wrangler configuration | Each consuming Worker |
| Durable Object namespace binding | Each consuming Worker |
| R2 bucket binding | Each consuming Worker |
| KV namespace binding | Each consuming Worker |

### 13.3 How Consumers Use This Repo

```typescript
// Minimal example
import { jwtAuthMiddleware, requireRole, secureCORS } from '@webwaka/core/auth';
import { BillingLedger, UsageCategory } from '@webwaka/core/billing';
import { AIEngine } from '@webwaka/core/ai';
import { sendOTP } from '@webwaka/core/notifications';
```

### 13.4 Versioning Policy

- This repo uses semver. `^1.x.x` in consumer `package.json`.
- **Breaking changes** require a major version bump (`2.0.0`).
- Removing an export = breaking change.
- Changing a method signature = breaking change.
- Adding new exports = minor version (`1.6.0`).
- Bug fixes = patch version (`1.5.1`).
- Before any major bump: notify all consuming repo maintainers.

### 13.5 Design Principles (Non-Negotiable)

1. **Build Once Use Infinitely** — Every primitive in this repo is consumed by multiple verticals. No duplication.
2. **Nigeria & Africa First** — All financial values in integer kobo. All notification providers Nigerian-first. All compliance follows Nigerian law first.
3. **Zero Console Logs** — All logging via `src/core/logger/index.ts`. No `console.log`, `console.warn`, `console.error` in source files.
4. **Vendor Neutral** — AI, payments, notifications: always use interfaces. Never hardcode a single vendor.
5. **Multi-Tenant** — Every operation scoped by `tenantId`. Cross-tenant access impossible by construction.
6. **Event-Driven** — No direct inter-DB access between services. All cross-service communication via events.
7. **Cloudflare-First** — Use Cloudflare Workers, KV, D1, R2, Queues, Durable Objects. No Node.js-only APIs.

---

## SECTION 14 — GOVERNANCE AND REMINDER BLOCK

> This block must be read and acknowledged before any implementation agent begins work.

### Non-Negotiable Rules

- [ ] Read the relevant source file(s) in full before making any change.
- [ ] Read `replit.md` for project context before starting.
- [ ] Read `CHANGELOG.md` to understand version history.
- [ ] All financial values must be **integer kobo**. Never float. Never naira without explicit, documented conversion.
- [ ] Never use `console.log`, `console.warn`, or `console.error` in source files. Use `src/core/logger/index.ts`.
- [ ] Never hardcode API keys, secrets, or credentials. All keys from constructor parameters or KV.
- [ ] `tenantId` must be a bound SQL parameter in every D1 query. Never string-interpolated.
- [ ] Any breaking change requires: semver major bump + CHANGELOG entry + notification to consuming repos.
- [ ] Every new function must have at least one test in the corresponding `.test.ts` file.
- [ ] All new exports must be added to `src/index.ts` (and the appropriate sub-path export if applicable).
- [ ] Test coverage thresholds: 80% lines/functions/statements, 75% branches. Do not lower them.
- [ ] Never leave TODO comments in code shipped to main. Either implement or open a documented task.
- [ ] Cross-repo context: this library's changes have platform-wide blast radius. Verify consumers before breaking changes.

### Mandatory Blueprint References

| Area | Blueprint Reference |
|---|---|
| Auth | Part 9.2 (Universal Architecture Standards — Auth & Authorization) |
| AI | Part 9.1 #7 (Vendor Neutral AI) |
| Notifications | Part 10.12, Part 9.1 #5 (Nigeria First) |
| Billing | Part 10.1, Part 9.1 #6 (Africa First — Integer Kobo) |
| RBAC | Part 2 Layer 4 (Tenant Resolution & Auth) |
| Events | Part 2 (Event-Driven: NO direct inter-DB access) |
| KYC | Part 10.11 (Fintech), Part 10.3 (Transport) |
| Geolocation | Part 10.3 (Transport), Part 10.4 (Logistics) |
| Booking | Part 10.3 (Transport), Part 10.7 (Health) |

---

## SECTION 15 — EXECUTION READINESS NOTES

### For Each Implementation Agent

Before executing any task in this document:

1. **Read the full task description** including objective, prerequisites, dependencies, acceptance criteria, and reminders.
2. **Read the target source files** in full before touching them.
3. **Check dependencies** — if a task depends on another (see Section 11), the dependency must be complete first.
4. **Run tests before making changes**: `pnpm run test` — ensure you start from green.
5. **Run lint before making changes**: `pnpm run lint` — ensure you start from zero type errors.
6. **Implement** following the exact specification in the task.
7. **Run tests after implementing**: `pnpm run test` — all must pass.
8. **Run lint after implementing**: `pnpm run lint` — must still be zero errors.
9. **Update CHANGELOG.md** with a new entry.
10. **Bump version** in `package.json` (patch for bug fix, minor for new feature, major for breaking change).

### For Each QA Agent

Before executing any QA prompt in this document:

1. **Read the full QA plan** for the task being verified.
2. **Run `pnpm run test`** and verify all tests pass.
3. **Run `pnpm run lint`** and verify zero type errors.
4. **Manually verify** each acceptance criterion from the task description.
5. **Test each edge case** listed in the QA plan.
6. **Check regressions** — run the full test suite, not just the changed module.
7. **Document findings** — if a bug is found, document it with the exact input that triggered it.
8. **Mark as passed or failed** with a brief note on what was verified.

### Environment Requirements

Each task implementation requires the following available in the development environment:

| Requirement | Notes |
|---|---|
| `pnpm` | Package manager (v10+) |
| `node` | v20 LTS |
| `tsc` | Installed via `pnpm install` |
| `vitest` | Installed via `pnpm install` |
| `@cloudflare/workers-types` | Already in devDependencies |
| D1 mock | Vitest can mock D1 via custom test helpers |
| KV mock | Vitest can mock KV via custom test helpers |
| Queue mock | Vitest can mock Queue.send() |
| R2 mock | Vitest can mock R2 put/get |
| Durable Objects mock | Requires Miniflare or Wrangler dev for full DO testing |

### Definition of Done (Platform-Wide)

A task is complete when:

- [ ] All acceptance criteria met
- [ ] All tests in the task's QA plan pass
- [ ] No TypeScript errors (`pnpm run lint` clean)
- [ ] No test failures (`pnpm run test` all green)
- [ ] Coverage thresholds maintained (80/80/75/80)
- [ ] CHANGELOG.md updated
- [ ] Version bumped appropriately
- [ ] No hardcoded secrets or API keys
- [ ] No console.log in source files
- [ ] All new exports in src/index.ts
- [ ] PR description references this taskbook task ID (e.g., "Implements T001")

---

*End of WEBWAKA-CORE-DEEP-RESEARCH-TASKBOOK.md*
*Total Tasks: 25 | Total QA Plans: 25 | Total Prompt Pairs: 25*
*Document Version: 1.0.0*
*Repository: https://github.com/WebWakaDOS/webwaka-core*
