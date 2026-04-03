/**
 * CORE-14 + CORE-9: Event Bus Primitives
 * Blueprint Reference: Part 2 (Platform Architecture — "Event-Driven: NO direct inter-DB access")
 *
 * Canonical event contracts for the entire WebWaka OS v4 platform.
 * Every domain emits typed DomainEvents; consumers subscribe by event type.
 *
 * This module defines shapes, constants, and the emitEvent utility.
 * Actual queue/bus wiring (Cloudflare Queues) is a separate concern.
 *
 * CORE-9 additions: UI Builder and AI Platform event types + typed payloads.
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

  // ─── UI Builder (CORE-9) ───────────────────────────────────────────────────
  UI_TEMPLATE_CREATED = 'ui.template.created',
  UI_TEMPLATE_UPDATED = 'ui.template.updated',
  UI_DEPLOYMENT_REQUESTED = 'ui.deployment.requested',
  UI_DEPLOYMENT_STARTED = 'ui.deployment.started',
  UI_DEPLOYMENT_SUCCESS = 'ui.deployment.success',
  UI_DEPLOYMENT_FAILED = 'ui.deployment.failed',
  UI_BRANDING_UPDATED = 'ui.branding.updated',

  // ─── AI Platform (CORE-9) ──────────────────────────────────────────────────
  AI_CAPABILITY_ENABLED = 'ai.capability.enabled',
  AI_CAPABILITY_DISABLED = 'ai.capability.disabled',
  AI_USAGE_RECORDED = 'ai.usage.recorded',
  AI_BYOK_KEY_ADDED = 'ai.byok.key.added',
  AI_BYOK_KEY_REMOVED = 'ai.byok.key.removed',

  // ─── Commerce ──────────────────────────────────────────────────────────────
  COMMERCE_ORDER_CREATED = 'commerce.order.created',
  COMMERCE_ORDER_PAID = 'commerce.order.paid',
  COMMERCE_ORDER_FULFILLED = 'commerce.order.fulfilled',
  COMMERCE_ORDER_CANCELLED = 'commerce.order.cancelled',
  COMMERCE_PRODUCT_CREATED = 'commerce.product.created',
  COMMERCE_PRODUCT_UPDATED = 'commerce.product.updated',
  COMMERCE_INVENTORY_UPDATED = 'commerce.inventory.updated',

  // ─── Logistics ─────────────────────────────────────────────────────────────
  LOGISTICS_PARCEL_CREATED = 'logistics.parcel.created',
  LOGISTICS_PARCEL_DISPATCHED = 'logistics.parcel.dispatched',
  LOGISTICS_PARCEL_IN_TRANSIT = 'logistics.parcel.in_transit',
  LOGISTICS_PARCEL_DELIVERED = 'logistics.parcel.delivered',
  LOGISTICS_PARCEL_FAILED = 'logistics.parcel.failed',
  LOGISTICS_ROUTE_OPTIMIZED = 'logistics.route.optimized',

  // ─── Civic ─────────────────────────────────────────────────────────────────
  CIVIC_MEMBER_CREATED = 'civic.member.created',
  CIVIC_MEMBER_UPDATED = 'civic.member.updated',
  CIVIC_EVENT_CREATED = 'civic.event.created',
  CIVIC_EVENT_CANCELLED = 'civic.event.cancelled',
  CIVIC_DUES_PAID = 'civic.dues.paid',
}

// ─── UI Builder Payload Types (CORE-9) ───────────────────────────────────────

/** Payload for ui.deployment.requested */
export interface UIDeploymentRequestedPayload {
  /** Unique deployment request ID */
  deploymentId: string;
  /** The template identifier to deploy */
  templateId: string;
  /** Tenant-specific branding and configuration */
  config: Record<string, unknown>;
  /** Optional custom domain for the deployment */
  customDomain?: string;
}

/** Payload for ui.deployment.success */
export interface UIDeploymentSuccessPayload {
  /** Unique deployment request ID (matches requested event) */
  deploymentId: string;
  /** The public URL of the deployed site */
  deploymentUrl: string;
  /** Cloudflare Pages project name */
  pagesProjectName: string;
}

/** Payload for ui.deployment.failed */
export interface UIDeploymentFailedPayload {
  /** Unique deployment request ID (matches requested event) */
  deploymentId: string;
  /** Human-readable error description */
  error: string;
  /** Raw error details for debugging */
  details?: unknown;
}

/** Payload for ui.branding.updated */
export interface UIBrandingUpdatedPayload {
  /** The KV key where the new branding config was stored */
  brandingKey: string;
}

// ─── Commerce Payload Types ───────────────────────────────────────────────────

/** Payload for commerce.order.created / commerce.order.paid / commerce.order.fulfilled / commerce.order.cancelled */
export interface CommerceOrderPayload {
  /** Unique order identifier */
  orderId: string;
  /** Customer user ID */
  customerId: string;
  /** Total order value in kobo (integer) */
  totalKobo: number;
  /** ISO 4217 currency code */
  currency: string;
  /** Line item identifiers */
  productIds: string[];
}

/** Payload for commerce.product.created / commerce.product.updated */
export interface CommerceProductPayload {
  /** Unique product identifier */
  productId: string;
  /** Product name */
  name: string;
  /** Price in kobo (integer) */
  priceKobo: number;
  /** SKU or catalog reference */
  sku?: string;
}

/** Payload for commerce.inventory.updated */
export interface CommerceInventoryUpdatedPayload {
  /** Product identifier */
  productId: string;
  /** New stock quantity after the update */
  stockQuantity: number;
  /** Previous stock quantity before the update */
  previousQuantity: number;
}

// ─── Logistics Payload Types ──────────────────────────────────────────────────

/** Payload for logistics.parcel.created / dispatched / in_transit / delivered / failed */
export interface LogisticsParcelPayload {
  /** Unique parcel identifier */
  parcelId: string;
  /** Human-readable tracking number */
  trackingNumber: string;
  /** Organisation that owns the parcel */
  organizationId: string;
  /** Destination address (free-form) */
  destination?: string;
}

/** Payload for logistics.route.optimized */
export interface LogisticsRouteOptimizedPayload {
  /** Route plan identifier */
  routeId: string;
  /** Ordered list of parcel IDs in the optimized sequence */
  parcelIds: string[];
  /** Estimated total distance in kilometres */
  estimatedDistanceKm?: number;
}

// ─── Civic Payload Types ──────────────────────────────────────────────────────

/** Payload for civic.member.created / civic.member.updated */
export interface CivicMemberPayload {
  /** Unique member identifier */
  memberId: string;
  /** Full name of the member */
  fullName: string;
  /** Membership tier or category */
  tier?: string;
}

/** Payload for civic.event.created / civic.event.cancelled */
export interface CivicEventPayload {
  /** Unique civic event identifier */
  eventId: string;
  /** Title of the civic event */
  title: string;
  /** Scheduled date/time in ISO 8601 format */
  scheduledAt: string;
  /** Venue or location description */
  venue?: string;
}

/** Payload for civic.dues.paid */
export interface CivicDuesPaidPayload {
  /** Member who paid their dues */
  memberId: string;
  /** Amount paid in kobo (integer) */
  amountKobo: number;
  /** Dues period (e.g. "2026-Q1") */
  period: string;
}

/** Payload for ai.capability.enabled / ai.capability.disabled */
export interface AICapabilityTogglePayload {
  /** The capability identifier (e.g., 'ai.commerce.product_description_generator') */
  capabilityId: string;
  /** The role or subscription tier this applies to, if scoped */
  scope?: string;
}

/** Payload for ai.usage.recorded — consumed by webwaka-central-mgmt for billing */
export interface AIUsageRecordedPayload {
  /** The capability that was invoked */
  capabilityId: string;
  /** The AI model that served the request */
  model: string;
  /** Number of prompt tokens consumed */
  promptTokens: number;
  /** Number of completion tokens generated */
  completionTokens: number;
  /** Total tokens (promptTokens + completionTokens) */
  totalTokens: number;
  /** Whether the request used the tenant's own BYOK key */
  usedByok: boolean;
  /** Estimated cost in USD (for platform billing reference) */
  estimatedCostUsd?: number;
}

export { OfflineEventQueue } from './offline-queue';
export type { SyncResult } from './offline-queue';

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
