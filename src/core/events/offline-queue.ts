/**
 * OfflineEventQueue — Browser-side event persistence for WebWaka OS v4
 *
 * This module is a **browser/service-worker companion** for the platform
 * event bus. It should NOT be imported inside Cloudflare Workers — it relies
 * on `navigator.onLine` and IndexedDB (via Dexie.js), which are browser APIs.
 *
 * Behaviour:
 *   - When online  → POSTs the event directly to the platform event bus URL.
 *   - When offline → Persists the event to IndexedDB via Dexie.js.
 *   - `sync()`     → Flushes all queued events to the bus; call on 'online'.
 *
 * Usage:
 *   const queue = new OfflineEventQueue('https://your-worker.workers.dev/events');
 *   await queue.push(event);
 *   window.addEventListener('online', () => queue.sync());
 */

import Dexie, { type Table } from 'dexie';
import type { WebWakaEvent } from './index';

interface QueuedEvent {
  id?: number;
  event: WebWakaEvent;
  queuedAt: number;
}

class EventQueueDB extends Dexie {
  events!: Table<QueuedEvent, number>;

  constructor(dbName: string) {
    super(dbName);
    this.version(1).stores({ events: '++id, queuedAt' });
  }
}

/** Result returned by `OfflineEventQueue.sync()`. */
export interface SyncResult {
  /** Number of events successfully delivered and removed from the queue. */
  synced: number;
  /** Number of events that failed to deliver (remain in the queue). */
  failed: number;
}

/**
 * OfflineEventQueue — Persist cross-platform events locally during outages.
 *
 * Instantiate once per application with the event bus endpoint URL.
 * Events are automatically routed: online → direct HTTP, offline → IndexedDB.
 */
export class OfflineEventQueue {
  private readonly db: EventQueueDB;
  private readonly syncUrl: string;

  /**
   * @param syncUrl  The HTTPS URL of the platform event bus Worker endpoint.
   * @param dbName   IndexedDB database name (override for isolated test instances).
   */
  constructor(syncUrl: string, dbName = 'WebWakaOfflineQueue') {
    this.syncUrl = syncUrl;
    this.db = new EventQueueDB(dbName);
  }

  /**
   * Push an event onto the queue.
   *
   * If the device is online and the HTTP delivery succeeds, the event is
   * sent directly and never touches IndexedDB. If offline — or if the
   * delivery fails — the event is persisted locally for later `sync()`.
   *
   * @param event  A well-formed `WebWakaEvent<T>` to publish.
   */
  async push(event: WebWakaEvent): Promise<void> {
    if (navigator.onLine) {
      try {
        const res = await fetch(this.syncUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) return;
      } catch {
        // Network error while "online" — fall through to persist locally
      }
    }
    await this.db.events.add({ event, queuedAt: Date.now() });
  }

  /**
   * Flush all locally-queued events to the platform event bus.
   *
   * Events are delivered in the order they were queued. Successfully
   * delivered events are removed from IndexedDB. Failed events are
   * retained and counted in `result.failed`.
   *
   * Call this when the device comes back online:
   *   `window.addEventListener('online', () => queue.sync())`
   *
   * @returns A `SyncResult` with counts of synced and failed events.
   */
  async sync(): Promise<SyncResult> {
    const queued = await this.db.events.orderBy('queuedAt').toArray();
    let synced = 0;
    let failed = 0;

    for (const item of queued) {
      try {
        const res = await fetch(this.syncUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.event),
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          await this.db.events.delete(item.id as number);
          synced++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    return { synced, failed };
  }

  /**
   * Returns the number of events currently waiting in the local queue.
   */
  async pendingCount(): Promise<number> {
    return this.db.events.count();
  }

  /**
   * Removes all events from the local queue without syncing them.
   * Use with caution — discarded events are permanently lost.
   */
  async clear(): Promise<void> {
    await this.db.events.clear();
  }
}
