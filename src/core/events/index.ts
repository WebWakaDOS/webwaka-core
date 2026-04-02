/**
 * CORE-14: Event Bus Primitives
 * Blueprint Reference: Part 2 (Platform Architecture — "Event-Driven: NO direct inter-DB access")
 *
 * Canonical event contracts for the entire WebWaka OS v4 platform.
 * Every domain emits typed DomainEvents; consumers subscribe by event type.
 *
 * This module defines shapes, constants, and the emitEvent utility.
 * Actual queue/bus wiring (Cloudflare Queues) is a separate concern.
 */

/**
 * Well-known event type names for all WebWaka OS v4 domains.
 *
 * Consumers MUST use these constants — never raw string literals — so that
 * renaming an event causes a compile-time error instead of a silent mismatch.
 */
export enum WebWakaEventType {
  // ─── Auth ──────────────────────────────────────────────────────────────────
  AUTH_USER_LOGIN = 'auth.user.login',
  AUTH_USER_LOGOUT = 'auth.user.logout',
  AUTH_TOKEN_REFRESHED = 'auth.token.refreshed',

  // ─── KYC ───────────────────────────────────────────────────────────────────
  KYC_SUBMITTED = 'kyc.submitted',
  KYC_VERIFIED = 'kyc.verified',
  KYC_REJECTED = 'kyc.rejected',

  // ─── Booking ───────────────────────────────────────────────────────────────
  BOOKING_CONFIRMED = 'booking.confirmed',
  BOOKING_CANCELLED = 'booking.cancelled',

  // ─── Chat ──────────────────────────────────────────────────────────────────
  CHAT_MESSAGE_SENT = 'chat.message.sent',
  CHAT_CHANNEL_CREATED = 'chat.channel.created',

  // ─── Document ──────────────────────────────────────────────────────────────
  DOCUMENT_CREATED = 'document.created',
  DOCUMENT_SIGNED = 'document.signed',

  // ─── Billing ───────────────────────────────────────────────────────────────
  BILLING_DEBIT_RECORDED = 'billing.debit.recorded',
  BILLING_CREDIT_RECORDED = 'billing.credit.recorded',

  // ─── Notification ──────────────────────────────────────────────────────────
  NOTIFICATION_SENT = 'notification.sent',
  NOTIFICATION_FAILED = 'notification.failed',
}

/**
 * Standard WebWaka Platform Event Bus Schema (Governance-Mandated)
 *
 * All events emitted to the platform event bus MUST adhere to this schema.
 * This is the canonical interface for cross-module communication.
 *
 * Reference: EVENT_BUS_SCHEMA.md in webwaka-platform-docs
 *
 * @template T  The event-specific payload type.
 */
export interface WebWakaEvent<T = unknown> {
  /** The event type (e.g., 'civic.event.created', 'parcel.created') */
  event: string;
  /** The ID of the tenant emitting the event */
  tenantId: string;
  /** The event-specific payload */
  payload: T;
  /** UTC Unix timestamp (ms) */
  timestamp: number;
}

/**
 * Envelope wrapping every domain event published on the platform bus.
 *
 * `type` is constrained to `WebWakaEventType` — arbitrary strings are rejected
 * at compile time, preventing undeclared event names from entering the bus.
 *
 * @deprecated Use WebWakaEvent<T> instead for governance compliance.
 * @template T  The event-specific payload type.
 */
export interface DomainEvent<T = unknown> {
  /** Unique event identifier (UUID v4). */
  id: string;
  /** Canonical event type — must be a WebWakaEventType constant. */
  type: WebWakaEventType;
  /** The tenant that owns this event. */
  tenantId: string;
  /** Wall-clock time the event was created. */
  occurredAt: Date;
  /** Domain-specific payload. */
  payload: T;
}

/**
 * Factory that creates a well-formed DomainEvent with a generated id and
 * current timestamp.
 *
 * @param type      A WebWakaEventType constant.
 * @param tenantId  Tenant that owns the event.
 * @param payload   Domain-specific payload.
 */
export function createEvent<T>(
  type: WebWakaEventType,
  tenantId: string,
  payload: T
): DomainEvent<T> {
  return {
    id: crypto.randomUUID(),
    type,
    tenantId,
    occurredAt: new Date(),
    payload,
  };
}

/**
 * KV-backed event bus environment interface.
 * Any Worker that needs to emit events must include these bindings.
 */
export interface EventBusEnv {
  /** KV namespace for outbound event queue (write-only from emitter side) */
  EVENTS?: KVNamespace;
  /** Optional HTTP endpoint to forward events to a central event router */
  EVENT_BUS_URL?: string;
}

/**
 * emitEvent — Publish a domain event to the platform event bus.
 *
 * Strategy:
 *   1. Write to EVENTS KV namespace as an outbox entry (TTL 24h)
 *   2. If EVENT_BUS_URL is set, also forward via HTTP POST (fire-and-forget)
 *
 * This function NEVER throws — failures are logged and swallowed so that
 * the calling business logic is never blocked by event bus unavailability.
 *
 * Uses the standardized WebWakaEvent<T> schema for governance compliance.
 *
 * @param env       Worker environment bindings (must include EVENTS KV)
 * @param eventType Canonical event type string (e.g. "civic.member.created")
 * @param tenantId  Tenant that owns this event
 * @param payload   Domain-specific payload (must be JSON-serialisable)
 */
export async function emitEvent(
  env: EventBusEnv,
  eventType: string,
  tenantId: string,
  payload: unknown,
): Promise<void> {
  const event: WebWakaEvent = {
    event: eventType,
    tenantId,
    payload,
    timestamp: Date.now(),
  };
  const key = `event:${Date.now()}:${crypto.randomUUID()}`;
  const body = JSON.stringify(event);

  // 1. Write to KV outbox
  if (env.EVENTS) {
    try {
      await env.EVENTS.put(key, body, { expirationTtl: 86400 });
    } catch {
      // Non-fatal — continue to HTTP delivery
    }
  }

  // 2. HTTP delivery (fire-and-forget)
  if (env.EVENT_BUS_URL) {
    try {
      await fetch(env.EVENT_BUS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Non-fatal — event is already in KV outbox
    }
  }
}
