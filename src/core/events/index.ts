/**
 * CORE-14: Event Bus Primitives
 * Blueprint Reference: Part 2 (Platform Architecture — "Event-Driven: NO direct inter-DB access")
 *
 * Canonical event contracts for the entire WebWaka OS v4 platform.
 * Every domain emits typed DomainEvents; consumers subscribe by event type.
 *
 * This module defines shapes and constants only.
 * Actual queue/bus wiring (Cloudflare Queues) is a separate concern.
 */

/**
 * Envelope wrapping every domain event published on the platform bus.
 *
 * @template T  The event-specific payload type.
 */
export interface DomainEvent<T = unknown> {
  /** Unique event identifier (UUID v4). */
  id: string;
  /** Canonical event type from WebWakaEventType. */
  type: string;
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
 * @param type      One of the WebWakaEventType constants.
 * @param tenantId  Tenant that owns the event.
 * @param payload   Domain-specific payload.
 */
export function createEvent<T>(
  type: string,
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
