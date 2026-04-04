import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveConflict, type VersionedRecord } from './conflict-resolver';

interface TestRecord extends VersionedRecord {
  name: string;
  email: string;
  balance: number;
}

const base: TestRecord = {
  id: 'rec_001',
  tenantId: 'tenant_alpha',
  version: 3,
  updatedAt: '2026-01-10T10:00:00.000Z',
  name: 'Alice',
  email: 'alice@example.com',
  balance: 5000,
};

const local: TestRecord = {
  ...base,
  updatedAt: '2026-01-11T09:00:00.000Z',  // later than remote
  name: 'Alice Updated',
  email: 'alice@example.com',
  balance: 6000,
};

const remote: TestRecord = {
  ...base,
  updatedAt: '2026-01-10T15:00:00.000Z',  // earlier than local
  name: 'Alice',
  email: 'alice@new.com',
  balance: 5500,
};

describe('resolveConflict — Optimistic Locking Conflict Resolver', () => {
  // ── Guard: mismatched records ────────────────────────────────────────────────

  it('returns resolved=false when records have different id values', () => {
    const result = resolveConflict(
      { ...local, id: 'rec_001' },
      { ...remote, id: 'rec_002' },
      'last-write-wins'
    );
    expect(result.resolved).toBe(false);
    expect(result.error).toMatch(/different id or tenantId/);
  });

  it('returns resolved=false when records have different tenantId values', () => {
    const result = resolveConflict(
      { ...local, tenantId: 'tenant_alpha' },
      { ...remote, tenantId: 'tenant_beta' },
      'last-write-wins'
    );
    expect(result.resolved).toBe(false);
    expect(result.error).toMatch(/different id or tenantId/);
  });

  // ── strategy: reject ────────────────────────────────────────────────────────

  describe("strategy: 'reject'", () => {
    it('always returns resolved=false', () => {
      const result = resolveConflict(local, remote, 'reject');
      expect(result.resolved).toBe(false);
    });

    it('sets strategy to "reject"', () => {
      const result = resolveConflict(local, remote, 'reject');
      expect(result.strategy).toBe('reject');
    });

    it('includes the record id in the error message', () => {
      const result = resolveConflict(local, remote, 'reject');
      expect(result.error).toMatch(/rec_001/);
    });

    it('does not produce a record', () => {
      const result = resolveConflict(local, remote, 'reject');
      expect(result.record).toBeUndefined();
    });
  });

  // ── strategy: last-write-wins ────────────────────────────────────────────────

  describe("strategy: 'last-write-wins'", () => {
    it('returns resolved=true', () => {
      const result = resolveConflict(local, remote, 'last-write-wins');
      expect(result.resolved).toBe(true);
    });

    it('picks the local record when local.updatedAt is later', () => {
      const result = resolveConflict(local, remote, 'last-write-wins');
      expect(result.record?.name).toBe(local.name);
      expect(result.record?.balance).toBe(local.balance);
    });

    it('picks the remote record when remote.updatedAt is later', () => {
      const olderLocal: TestRecord = { ...local, updatedAt: '2026-01-09T00:00:00.000Z' };
      const result = resolveConflict(olderLocal, remote, 'last-write-wins');
      expect(result.record?.email).toBe(remote.email);
      expect(result.record?.balance).toBe(remote.balance);
    });

    it('picks the remote record on an exact tie (remote is authoritative)', () => {
      const tied: TestRecord = { ...local, updatedAt: remote.updatedAt };
      const result = resolveConflict(tied, remote, 'last-write-wins');
      expect(result.record?.email).toBe(remote.email);
    });

    it('bumps version to max(local, remote) + 1', () => {
      const result = resolveConflict(local, remote, 'last-write-wins');
      expect(result.record?.version).toBe(Math.max(local.version, remote.version) + 1);
    });

    it('sets updatedAt to the current time (after both input timestamps)', () => {
      const before = new Date().toISOString();
      const result = resolveConflict(local, remote, 'last-write-wins');
      const after = new Date().toISOString();
      const updatedAt = result.record?.updatedAt ?? '';
      expect(updatedAt >= before).toBe(true);
      expect(updatedAt <= after).toBe(true);
    });

    it('preserves id and tenantId from the winner', () => {
      const result = resolveConflict(local, remote, 'last-write-wins');
      expect(result.record?.id).toBe('rec_001');
      expect(result.record?.tenantId).toBe('tenant_alpha');
    });

    it('sets strategy to "last-write-wins"', () => {
      const result = resolveConflict(local, remote, 'last-write-wins');
      expect(result.strategy).toBe('last-write-wins');
    });
  });

  // ── strategy: field-merge ────────────────────────────────────────────────────

  describe("strategy: 'field-merge'", () => {
    it('returns resolved=true', () => {
      const result = resolveConflict(local, remote, 'field-merge');
      expect(result.resolved).toBe(true);
    });

    it('lists all fields that differ as conflictedFields', () => {
      // local has: name=Alice Updated, email=alice@example.com, balance=6000
      // remote has: name=Alice,        email=alice@new.com,     balance=5500
      const result = resolveConflict(local, remote, 'field-merge');
      expect(result.conflictedFields).toContain('name');
      expect(result.conflictedFields).toContain('email');
      expect(result.conflictedFields).toContain('balance');
    });

    it('remote wins on conflicted fields', () => {
      const result = resolveConflict(local, remote, 'field-merge');
      expect(result.record?.name).toBe(remote.name);
      expect(result.record?.email).toBe(remote.email);
      expect(result.record?.balance).toBe(remote.balance);
    });

    it('identical fields have no conflict and are preserved', () => {
      // Give local and remote the same name but different email
      const localSameName: TestRecord = { ...local, name: base.name };
      const result = resolveConflict(localSameName, remote, 'field-merge');
      expect(result.conflictedFields).not.toContain('name');
      expect(result.record?.name).toBe(base.name);
    });

    it('does not include meta fields in conflictedFields', () => {
      const result = resolveConflict(local, remote, 'field-merge');
      const meta = ['id', 'tenantId', 'version', 'updatedAt', 'createdAt', 'deletedAt'];
      for (const field of meta) {
        expect(result.conflictedFields).not.toContain(field);
      }
    });

    it('bumps version to max(local, remote) + 1', () => {
      const result = resolveConflict(local, remote, 'field-merge');
      expect(result.record?.version).toBe(Math.max(local.version, remote.version) + 1);
    });

    it('sets updatedAt to a current ISO timestamp', () => {
      const before = new Date().toISOString();
      const result = resolveConflict(local, remote, 'field-merge');
      const after = new Date().toISOString();
      const updatedAt = result.record?.updatedAt ?? '';
      expect(updatedAt >= before).toBe(true);
      expect(updatedAt <= after).toBe(true);
    });

    it('preserves id and tenantId in merged record', () => {
      const result = resolveConflict(local, remote, 'field-merge');
      expect(result.record?.id).toBe('rec_001');
      expect(result.record?.tenantId).toBe('tenant_alpha');
    });

    it('sets strategy to "field-merge"', () => {
      const result = resolveConflict(local, remote, 'field-merge');
      expect(result.strategy).toBe('field-merge');
    });

    it('handles records with no conflicting domain fields (empty conflictedFields)', () => {
      const result = resolveConflict(base, { ...base }, 'field-merge');
      expect(result.resolved).toBe(true);
      expect(result.conflictedFields).toHaveLength(0);
    });

    it('preserves createdAt from localRecord when set', () => {
      const withCreatedAt: TestRecord = { ...local, createdAt: '2025-01-01T00:00:00.000Z' };
      const result = resolveConflict(withCreatedAt, remote, 'field-merge');
      expect(result.record?.['createdAt']).toBe('2025-01-01T00:00:00.000Z');
    });
  });

  // ── Version handling across all strategies ───────────────────────────────────

  it('always uses the higher version when records have different version numbers', () => {
    const highLocal: TestRecord = { ...local, version: 10 };
    const lowRemote: TestRecord = { ...remote, version: 5 };

    for (const strategy of ['last-write-wins', 'field-merge'] as const) {
      const result = resolveConflict(highLocal, lowRemote, strategy);
      expect(result.record?.version).toBe(11); // max(10, 5) + 1
    }
  });
});
