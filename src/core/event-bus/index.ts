/**
 * @webwaka/core — Event Bus Module
 * Blueprint Reference: Part 5 (Platform Event Bus)
 *
 * Standardized event schema and helpers for cross-module communication.
 */

export interface WebWakaEvent<T = unknown> {
  event: string;
  tenantId: string;
  payload: T;
  timestamp: number;
}

export interface EventBusEnv {
  EVENTS?: KVNamespace;
}

/**
 * Emit an event to the centralized event bus.
 */
export async function emitEvent<T>(
  env: EventBusEnv,
  eventName: string,
  tenantId: string,
  payload: T
): Promise<void> {
  if (!env.EVENTS) {
    console.warn(`[EventBus] No EVENTS binding found. Skipping event: ${eventName}`);
    return;
  }

  const event: WebWakaEvent<T> = {
    event: eventName,
    tenantId,
    payload,
    timestamp: Date.now(),
  };

  const key = `event:${tenantId}:${eventName}:${event.timestamp}:${Math.random().toString(36).substring(2, 9)}`;
  
  try {
    await env.EVENTS.put(key, JSON.stringify(event));
  } catch (error) {
    console.error(`[EventBus] Failed to emit event ${eventName}:`, error);
  }
}
