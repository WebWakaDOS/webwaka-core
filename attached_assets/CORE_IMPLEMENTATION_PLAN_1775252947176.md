# WebWaka Core (`webwaka-core`) Implementation Plan

**Prepared by:** Manus AI
**Date:** April 2026
**Target Repository:** `webwaka-core`

## 1. Executive Summary

`webwaka-core` is the foundational shared primitives library for the entire WebWaka OS v4 ecosystem. It enforces the "Build Once, Use Infinitely" invariant. This implementation plan details the next phase of enhancements required to support the 12 vertical suites, focusing on offline resilience, advanced KYC, and unified event schemas.

## 2. Current State vs. Target State

**Current State:**
- Provides basic JWT auth, RBAC, and Termii SMS notifications.
- Event schema is fragmented across downstream consumers.
- AI primitive relies solely on OpenRouter with no local fallback.

**Target State:**
- Unified `WebWakaEvent<T>` schema enforced across all 14 repos.
- Advanced KYC primitive with NIMC vNIN and BVN facial matching.
- Offline-first event queue with Dexie.js sync resolution.
- Local Llama-3 fallback for AI completions.

## 3. Enhancement Backlog (Top 20)

1. **Termii WhatsApp-to-Voice Fallback:** Automated voice call fallback for critical OTPs.
2. **NIMC vNIN Verification Engine:** Native vNIN verification primitive.
3. **BVN Facial Matching:** NIBSS facial matching endpoints for Tier 3 KYC.
4. **Offline Auth Token Renewal:** Encrypted IndexedDB refresh tokens.
5. **Multi-Currency Kobo Abstraction:** Support for GHS (pesewas) and KES (cents).
6. **Local LLM Fallback:** Llama-3 local inference fallback.
7. **NIP (NIBSS Instant Payment) Primitive:** Native NIP transfer abstractions.
8. **CAC Company Registry Sync:** Automated KYB via CAC API.
9. **FIRS TIN Validation:** Tax Identification Number verification.
10. **Offline-First Event Queue:** Persist cross-repo events locally during outages.
11. **USSD Gateway Primitive:** Shared USSD session management.
12. **Address Standardization Engine:** Nigerian state/LGA/ward address normalizer.
13. **Bank Account Name Enquiry:** NIBSS name enquiry primitive.
14. **Optimistic Locking Conflict Resolver:** Auto-merge strategies for offline conflicts.
15. **Biometric Liveness Detection:** Passive liveness detection.
16. **NQR (Nigeria Quick Response) Generator:** NQR code generation.
17. **VAT/WHT Split Ledger:** Automatically split VAT and WHT.
18. **E-Naira Integration Stub:** Prepare for eNaira wallet interactions.
19. **Fraud Scoring Engine:** Lightweight rule-based fraud scoring.
20. **Audit Log Immutable Storage:** Route critical logs to WORM storage.

## 4. Execution Phases

### Phase 1: Event Schema Unification
- Standardize `WebWakaEvent<T>` in `src/core/events/index.ts`.
- Export canonical event types for all verticals.

### Phase 2: Advanced KYC & Identity
- Implement `verifyVNIN()` and `matchBVNFace()` in `src/core/kyc/index.ts`.
- Add CAC registry sync for KYB.

### Phase 3: Offline Resilience
- Implement `OfflineEventQueue` using Dexie.js.
- Add optimistic locking conflict resolution.

## 5. Replit Execution Prompts

**Prompt 1: Event Schema Unification**
```text
You are the Replit execution agent for `webwaka-core`.
Task: Unify the event schema.
1. Open `src/core/events/index.ts`.
2. Ensure `WebWakaEvent<T>` is the single canonical interface.
3. Add all required event types for Commerce, Logistics, and Civic.
4. Run `npm run build` to verify exports.
```

**Prompt 2: Advanced KYC**
```text
You are the Replit execution agent for `webwaka-core`.
Task: Implement advanced KYC primitives.
1. Create `src/core/kyc/nimc.ts` and implement `verifyVNIN(vnin: string)`.
2. Create `src/core/kyc/nibss.ts` and implement `matchBVNFace(bvn: string, imageBase64: string)`.
3. Export both from `src/core/kyc/index.ts`.
4. Add unit tests in `src/core/kyc/index.test.ts`.
```
