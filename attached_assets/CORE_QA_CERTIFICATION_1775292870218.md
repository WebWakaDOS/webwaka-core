# WebWaka Core (`webwaka-core`) QA Certification

**Prepared by:** Manus AI
**Date:** April 2026
**Target Repository:** `webwaka-core`

## 1. Audit Scope

This QA certification covers the implementation of the unified event schema, advanced KYC primitives, and offline resilience features in `webwaka-core`.

## 2. Acceptance Criteria

| ID | Feature | Acceptance Criteria | Status |
| :--- | :--- | :--- | :--- |
| QA-CORE-1 | Event Schema | `WebWakaEvent<T>` is the single canonical interface exported from `src/core/events/index.ts`. | PENDING |
| QA-CORE-2 | KYC Primitives | `verifyVNIN()` and `matchBVNFace()` are implemented and exported from `src/core/kyc/index.ts`. | PENDING |
| QA-CORE-3 | Offline Queue | `OfflineEventQueue` correctly persists events to Dexie.js when `navigator.onLine` is false. | PENDING |
| QA-CORE-4 | Unit Tests | All new primitives have passing unit tests in `src/core/**/*.test.ts`. | PENDING |

## 3. Offline Resilience Testing

1. Disconnect network.
2. Trigger an event using `OfflineEventQueue.push()`.
3. Verify the event is stored in the local IndexedDB.
4. Reconnect network.
5. Verify the event is synced to the Cloudflare D1 backend and removed from IndexedDB.

## 4. Security & RBAC Validation

- Verify that KYC primitives require a valid `ADMIN_API_KEY` or `TENANT_SECRET` to execute.
- Ensure no PII (Personally Identifiable Information) is logged by the `logger` primitive during KYC verification.

## 5. Regression Guards

- Run `npm run test` to ensure 100% pass rate.
- Run `npm run build` to ensure no TypeScript compilation errors.
- Verify that downstream consumers (e.g., `webwaka-commerce`) can still import the legacy `WebWakaEventType` enum during the migration phase.
