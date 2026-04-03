/**
 * QA-CORE-3: OfflineEventQueue unit tests
 *
 * Dexie is mocked with an in-memory Map so tests run in Node/Vitest without
 * a real IndexedDB. `navigator.onLine` and `fetch` are stubbed per test.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SyncResult } from './offline-queue';

// ─── In-memory Dexie mock ────────────────────────────────────────────────────

interface MockRow { id: number; event: unknown; queuedAt: number }

const store: Map<number, MockRow> = new Map();
let nextId = 1;

function resetStore() {
  store.clear();
  nextId = 1;
}

vi.mock('dexie', () => {
  const mockTable = {
    add: vi.fn(async (item: { event: unknown; queuedAt: number }) => {
      const id = nextId++;
      store.set(id, { ...item, id });
      return id;
    }),
    delete: vi.fn(async (id: number) => { store.delete(id); }),
    count: vi.fn(async () => store.size),
    clear: vi.fn(async () => { store.clear(); nextId = 1; }),
    orderBy: vi.fn(() => ({
      toArray: vi.fn(async () =>
        [...store.values()].sort((a, b) => a.queuedAt - b.queuedAt)
      ),
    })),
  };

  class MockDexie {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;

    version(_n: number) {
      return {
        stores: (_schema: Record<string, string>) => {
          // Assign tables after stores() — runs after EventQueueDB's class
          // field initializers, so it correctly overrides the undefined set
          // by `events!: Table<...>` in the subclass.
          this['events'] = mockTable;
          return this;
        },
      };
    }
  }

  return { default: MockDexie };
});

// Import AFTER vi.mock hoisting resolves
import { OfflineEventQueue } from './offline-queue';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SYNC_URL = 'https://api.example.test/events';

const sampleEvent = {
  event: 'auth.user.login',
  tenantId: 'tenant_alpha',
  payload: { userId: 'u_1' },
  timestamp: 1_700_000_000_000,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('QA-CORE-3: OfflineEventQueue', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });

  // ── push() — online ────────────────────────────────────────────────────────

  describe('push() when online', () => {
    it('sends the event directly to the sync URL', async () => {
      const queue = new OfflineEventQueue(SYNC_URL);
      await queue.push(sampleEvent);
      expect(fetch).toHaveBeenCalledWith(
        SYNC_URL,
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('does not persist to IndexedDB on successful delivery', async () => {
      const queue = new OfflineEventQueue(SYNC_URL);
      await queue.push(sampleEvent);
      expect(await queue.pendingCount()).toBe(0);
    });

    it('falls back to IndexedDB when fetch throws a network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
      const queue = new OfflineEventQueue(SYNC_URL);
      await queue.push(sampleEvent);
      expect(await queue.pendingCount()).toBe(1);
    });

    it('falls back to IndexedDB when the server returns a non-OK status', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
      const queue = new OfflineEventQueue(SYNC_URL);
      await queue.push(sampleEvent);
      expect(await queue.pendingCount()).toBe(1);
    });
  });

  // ── push() — offline ───────────────────────────────────────────────────────

  describe('push() when offline (navigator.onLine === false)', () => {
    beforeEach(() => {
      vi.stubGlobal('navigator', { onLine: false });
    });

    it('persists the event to IndexedDB without a network request', async () => {
      const queue = new OfflineEventQueue(SYNC_URL);
      await queue.push(sampleEvent);
      expect(fetch).not.toHaveBeenCalled();
      expect(await queue.pendingCount()).toBe(1);
    });

    it('accumulates multiple events in the queue', async () => {
      const queue = new OfflineEventQueue(SYNC_URL);
      await queue.push(sampleEvent);
      await queue.push({ ...sampleEvent, event: 'kyc.submitted' });
      await queue.push({ ...sampleEvent, event: 'booking.confirmed' });
      expect(await queue.pendingCount()).toBe(3);
    });
  });

  // ── sync() ─────────────────────────────────────────────────────────────────

  describe('sync()', () => {
    it('returns { synced: 0, failed: 0 } when the queue is empty', async () => {
      const queue = new OfflineEventQueue(SYNC_URL);
      const result = await queue.sync();
      expect(result).toEqual<SyncResult>({ synced: 0, failed: 0 });
    });

    it('delivers all queued events and removes them from IndexedDB', async () => {
      vi.stubGlobal('navigator', { onLine: false });
      const queue = new OfflineEventQueue(SYNC_URL);
      await queue.push(sampleEvent);
      await queue.push({ ...sampleEvent, event: 'kyc.verified' });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
      const result = await queue.sync();

      expect(result).toEqual<SyncResult>({ synced: 2, failed: 0 });
      expect(await queue.pendingCount()).toBe(0);
    });

    it('counts failures and retains those events in IndexedDB', async () => {
      vi.stubGlobal('navigator', { onLine: false });
      const queue = new OfflineEventQueue(SYNC_URL);
      await queue.push(sampleEvent);
      await queue.push({ ...sampleEvent, event: 'kyc.verified' });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
      const result = await queue.sync();

      expect(result).toEqual<SyncResult>({ synced: 0, failed: 2 });
      expect(await queue.pendingCount()).toBe(2);
    });

    it('handles partial failures — removes synced, retains failed', async () => {
      vi.stubGlobal('navigator', { onLine: false });
      const queue = new OfflineEventQueue(SYNC_URL);
      await queue.push({ ...sampleEvent, event: 'auth.user.login' });
      await queue.push({ ...sampleEvent, event: 'kyc.submitted' });

      let callCount = 0;
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
        callCount++;
        return { ok: callCount === 1 };
      }));

      const result = await queue.sync();
      expect(result.synced).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('counts as failed when fetch throws during sync', async () => {
      vi.stubGlobal('navigator', { onLine: false });
      const queue = new OfflineEventQueue(SYNC_URL);
      await queue.push(sampleEvent);

      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network timeout')));
      const result = await queue.sync();

      expect(result.failed).toBe(1);
      expect(result.synced).toBe(0);
    });

    it('POSTs each event body as JSON to the sync URL', async () => {
      vi.stubGlobal('navigator', { onLine: false });
      const queue = new OfflineEventQueue(SYNC_URL);
      await queue.push(sampleEvent);

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
      await queue.sync();

      expect(fetch).toHaveBeenCalledWith(
        SYNC_URL,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
  });

  // ── pendingCount() ─────────────────────────────────────────────────────────

  describe('pendingCount()', () => {
    it('returns 0 for a fresh queue', async () => {
      const queue = new OfflineEventQueue(SYNC_URL);
      expect(await queue.pendingCount()).toBe(0);
    });

    it('increments correctly with each offline push', async () => {
      vi.stubGlobal('navigator', { onLine: false });
      const queue = new OfflineEventQueue(SYNC_URL);
      await queue.push(sampleEvent);
      expect(await queue.pendingCount()).toBe(1);
      await queue.push(sampleEvent);
      expect(await queue.pendingCount()).toBe(2);
    });
  });

  // ── clear() ────────────────────────────────────────────────────────────────

  describe('clear()', () => {
    it('removes all queued events without syncing', async () => {
      vi.stubGlobal('navigator', { onLine: false });
      const queue = new OfflineEventQueue(SYNC_URL);
      await queue.push(sampleEvent);
      await queue.push(sampleEvent);
      await queue.clear();
      expect(await queue.pendingCount()).toBe(0);
      expect(fetch).not.toHaveBeenCalled();
    });
  });
});
