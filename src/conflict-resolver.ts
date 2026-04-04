/**
 * Optimistic Locking Conflict Resolver
 * Blueprint Reference: Phase 3 Offline Resilience — Auto-merge strategies
 *
 * When two writes diverge (e.g. an offline edit re-syncs against a server
 * record that was independently updated), `updateWithVersionLock` returns
 * `{ conflict: true }`. This module resolves those conflicts using one of
 * three pluggable strategies so the calling Worker can decide how to proceed.
 *
 * Strategies:
 *   - 'last-write-wins'  — Whichever record has the later `updatedAt` wins.
 *   - 'field-merge'      — Non-conflicting fields from both records are merged;
 *                          remote (server) wins when both sides changed the
 *                          same field.
 *   - 'reject'           — Never auto-merge; surface the conflict to the caller.
 *
 * All strategies bump `version` by one and set `updatedAt` to the current
 * wall-clock time so the resolved record can be safely written via a
 * subsequent `updateWithVersionLock` call.
 */

/** Strategy name for resolving an optimistic-lock conflict. */
export type ConflictResolutionStrategy = 'last-write-wins' | 'field-merge' | 'reject';

/**
 * Minimum shape every versioned D1 record must satisfy.
 * Extend this interface in each domain (e.g. `Booking extends VersionedRecord`).
 */
export interface VersionedRecord {
  /** Primary key */
  id: string;
  /** Tenant that owns this record */
  tenantId: string;
  /** Monotonically increasing version counter */
  version: number;
  /** ISO 8601 wall-clock timestamp of the last mutation */
  updatedAt: string;
  /** Any additional domain fields */
  [key: string]: unknown;
}

/** Returned by `resolveConflict()`. */
export interface ConflictResolutionResult<T extends VersionedRecord> {
  /** Whether a merged record was produced. False only for 'reject' or invalid inputs. */
  resolved: boolean;
  /** The merged record — only present when `resolved` is true. */
  record?: T;
  /** The strategy that was applied. */
  strategy?: ConflictResolutionStrategy;
  /**
   * For 'field-merge': the list of field names where both local and remote
   * had differing values (remote won).
   */
  conflictedFields?: string[];
  /** Human-readable description when `resolved` is false. */
  error?: string;
}

/**
 * Metadata fields managed by the platform — never compared or merged between
 * local and remote copies.
 */
const META_FIELDS: ReadonlySet<string> = new Set([
  'id',
  'tenantId',
  'version',
  'updatedAt',
  'createdAt',
  'deletedAt',
]);

/**
 * resolveConflict — Apply an auto-merge strategy to a pair of conflicting records.
 *
 * @param localRecord   The locally-modified version (e.g. from an offline sync).
 * @param remoteRecord  The authoritative server version.
 * @param strategy      Which resolution strategy to apply.
 *
 * @returns A `ConflictResolutionResult<T>` containing the merged record
 *          (when resolved) or an error description (when rejected or invalid).
 */
export function resolveConflict<T extends VersionedRecord>(
  localRecord: T,
  remoteRecord: T,
  strategy: ConflictResolutionStrategy,
): ConflictResolutionResult<T> {
  // Guard: records must represent the same entity
  if (localRecord.id !== remoteRecord.id || localRecord.tenantId !== remoteRecord.tenantId) {
    return {
      resolved: false,
      error: 'Cannot resolve conflict: records have different id or tenantId',
    };
  }

  const nowIso = new Date().toISOString();
  const nextVersion = Math.max(localRecord.version, remoteRecord.version) + 1;

  switch (strategy) {
    // ── reject ────────────────────────────────────────────────────────────────
    case 'reject': {
      return {
        resolved: false,
        strategy: 'reject',
        error: `Conflict on record "${localRecord.id}" (v${localRecord.version} vs v${remoteRecord.version}): manual resolution required`,
      };
    }

    // ── last-write-wins ───────────────────────────────────────────────────────
    case 'last-write-wins': {
      const localTime = new Date(localRecord.updatedAt).getTime();
      const remoteTime = new Date(remoteRecord.updatedAt).getTime();
      // Ties are broken in favour of the remote (server) record
      const winner: T = localTime > remoteTime ? localRecord : remoteRecord;
      return {
        resolved: true,
        strategy: 'last-write-wins',
        record: {
          ...winner,
          version: nextVersion,
          updatedAt: nowIso,
        } as T,
      };
    }

    // ── field-merge ───────────────────────────────────────────────────────────
    case 'field-merge': {
      // Collect all non-meta domain field keys from both sides
      const allDomainKeys = Array.from(
        new Set([...Object.keys(localRecord), ...Object.keys(remoteRecord)])
      ).filter((k) => !META_FIELDS.has(k));

      const conflictedFields: string[] = [];
      const merged: Record<string, unknown> = {};

      for (const key of allDomainKeys) {
        const localSerialized = JSON.stringify(localRecord[key]);
        const remoteSerialized = JSON.stringify(remoteRecord[key]);

        if (localSerialized !== remoteSerialized) {
          // Both sides differ — remote (authoritative server state) wins
          conflictedFields.push(key);
          merged[key] = remoteRecord[key];
        } else {
          // Identical — safe to use either value
          merged[key] = localRecord[key];
        }
      }

      return {
        resolved: true,
        strategy: 'field-merge',
        conflictedFields,
        record: {
          ...merged,
          id: localRecord.id,
          tenantId: localRecord.tenantId,
          version: nextVersion,
          updatedAt: nowIso,
          // Preserve createdAt from whichever record has it
          ...(localRecord['createdAt'] !== undefined && { createdAt: localRecord['createdAt'] }),
        } as T,
      };
    }
  }
}
