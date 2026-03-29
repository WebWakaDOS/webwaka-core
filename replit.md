# @webwaka/core

WebWaka OS v4 — Shared platform primitives for the WebWaka SaaS ecosystem.

## Overview

This is a **TypeScript library package** (not a web server) designed to run on **Cloudflare Workers**. It provides reusable platform primitives for multi-tenant SaaS applications with an Africa-first philosophy.

## Tech Stack

- **Language**: TypeScript (ES2022/ESNext)
- **Framework**: Hono (peer dependency, lightweight web framework)
- **Runtime Target**: Cloudflare Workers (`@cloudflare/workers-types`)
- **Build Tool**: TypeScript compiler (`tsc`)
- **Test Runner**: Vitest
- **Package Manager**: pnpm

## Project Structure

```
src/
├── index.ts              # Main entry point — re-exports all primitives
└── core/
    ├── ai/               # AI Engine (3-tier fallback: Tenant BYOK → Platform Key → CF Workers AI)
    ├── auth/             # JWT auth, CORS, rate limiting (Hono middleware)
    ├── billing/          # Usage ledger (integer kobo values for Africa)
    ├── booking/          # Booking management
    ├── chat/             # Chat service primitives
    ├── document/         # Document management
    ├── event-bus/        # Event-driven communication types
    ├── geolocation/      # Location-based services
    ├── kyc/              # Know Your Customer (identity verification)
    ├── logger/           # Structured logging (zero console.log policy)
    ├── notifications/    # Unified notifications (Yournotify email, Termii SMS)
    └── rbac/             # Role-Based Access Control
```

## Workflow

The "Start application" workflow runs `pnpm run build && pnpm run test` — compiles the library and runs all 61 unit tests.

## Changes & Improvements

### Security Audit Pass (notifications + billing)
- **notifications/index.ts**: Replaced all bare `console.warn`/`console.error` calls with the platform `logger` — enforcing the "Zero Console Logs" invariant across the entire module
- **billing/index.ts**: Replaced `private db: any` and `constructor(db: any)` with the proper `D1Database` global type — eliminating all `any` usage and enforcing the "No `any` types" rule; `metadata` type narrowed from `Record<string, any>` to `Record<string, unknown>`

### Vitest Coverage Enforcement
- `vitest.config.ts` now sets `all: true` (all source files included, even if not imported by tests) and 100% thresholds on statements, branches, functions, and lines

### GitHub Actions
- `.github/workflows/publish.yml`: New workflow — triggers on version tags (`v*.*.*`), runs lint → test → build → `pnpm publish` with `NPM_TOKEN` secret; isolated to `npm-publish` environment
- `.github/workflows/ci.yml`: Fixed from broken `npm ci` → correct `pnpm install --frozen-lockfile`; added type-check and build steps
- `.github/workflows/deploy.yml`: Same pnpm fix; added lint + build steps before release

## Bug Fixes Applied During Import

1. **billing/index.ts**: Fixed `exactOptionalPropertyTypes` TS error for optional `metadata` field using spread
2. **logger/index.ts**: 
   - Replaced `process.env` reference (unavailable in WebWorker) with `globalThis.DEV_MODE`
   - Fixed `exactOptionalPropertyTypes` errors for optional `context` and `error` fields using spread
   - Changed `LogEntry.error` type from `Error` to `SerializedError` (`{ message, stack? }`) for proper JSON serialization

## Build & Test

```bash
pnpm install     # Install dependencies
pnpm run build   # Compile TypeScript to dist/
pnpm run test    # Run all 61 unit tests
```

## Package Exports

The package exports primitives via sub-paths:
- `@webwaka/core` — all primitives
- `@webwaka/core/auth` — JWT auth middleware
- `@webwaka/core/rbac` — role-based access control
- `@webwaka/core/billing` — billing ledger
- `@webwaka/core/logger` — platform logger
- `@webwaka/core/event-bus` — event bus types
