import type { PGlite } from '@electric-sql/pglite';
import type { GovernanceOverlayEntry, MemoryRecord } from '@/types/governed';
import { getDb } from './client';

/**
 * Serial write journal. The kernel's seams are synchronous, so writes update
 * the in-process snapshot immediately and persistence to Postgres is enqueued
 * here. The queue is a promise chain — strictly ordered, one writer — so a
 * test truncate can never race a later insert. `flushAuthority()` awaits the
 * tail and rethrows the first persistence failure, which is how entrypoints
 * (CLI, MCP, API routes, tests) confirm durability before returning.
 */

let tail: Promise<void> = Promise.resolve();
let firstError: unknown = null;

function enqueue(op: (db: PGlite) => Promise<void>): void {
  tail = tail
    .then(async () => op(await getDb()))
    .catch((err) => {
      if (firstError === null) firstError = err;
      console.error('[memrails authority] persist failed:', err);
    });
}

export async function flushAuthority(): Promise<void> {
  await tail;
  if (firstError !== null) {
    const err = firstError;
    firstError = null;
    throw err instanceof Error ? err : new Error(String(err));
  }
}

/** Upsert a written record: registry row + sources + contradiction edges. */
export function persistWrittenRecord(record: MemoryRecord): void {
  enqueue(async (db) => {
    await db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO memory_registry
           (memory_id, origin, owner_id, project_id, agent_id, status, confidence,
            sensitivity, superseded_by, record, created_at, updated_at)
         VALUES ($1, 'written', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (memory_id) DO UPDATE SET
           origin = 'written', owner_id = $2, project_id = $3, agent_id = $4,
           status = $5, confidence = $6, sensitivity = $7, superseded_by = $8,
           record = $9, updated_at = $11`,
        [
          record.memory_id,
          record.scope.owner_id,
          record.scope.project_id,
          record.scope.agent_id ?? null,
          record.status,
          record.confidence,
          record.sensitivity,
          record.superseded_by ?? null,
          JSON.stringify(record),
          record.created_at,
          record.updated_at,
        ],
      );
      await tx.query('DELETE FROM memory_sources WHERE memory_id = $1', [record.memory_id]);
      for (let seq = 0; seq < record.source_refs.length; seq += 1) {
        const s = record.source_refs[seq];
        await tx.query(
          `INSERT INTO memory_sources (memory_id, seq, type, source_id, ref, hash)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [record.memory_id, seq, s.type, s.id ?? null, s.ref ?? null, s.hash ?? null],
        );
      }
      await tx.query('DELETE FROM contradiction_edges WHERE from_memory_id = $1', [record.memory_id]);
      for (const to of record.contradictions) {
        await tx.query(
          `INSERT INTO contradiction_edges (from_memory_id, to_memory_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [record.memory_id, to],
        );
      }
    });
  });
}

/**
 * Upsert one governance overlay entry: typed columns for SQL, the entry
 * verbatim in `overlay` (for exact round-trips), versions normalized into
 * `memory_versions`. Corpus-origin ids get a governance-only row.
 */
export function persistOverlayEntry(memory_id: string, entry: GovernanceOverlayEntry): void {
  enqueue(async (db) => {
    const { versions = [], ...bare } = entry;
    await db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO memory_registry
           (memory_id, origin, status, confidence, sensitivity, superseded_by,
            disputed_reason, tombstoned_at, overlay, updated_at)
         VALUES ($1, 'corpus', $2, $3, $4, $5, $6, $7, $8, now())
         ON CONFLICT (memory_id) DO UPDATE SET
           status = $2,
           confidence = COALESCE($3, memory_registry.confidence),
           sensitivity = COALESCE($4, memory_registry.sensitivity),
           superseded_by = $5, disputed_reason = $6, tombstoned_at = $7,
           overlay = $8, updated_at = now()`,
        [
          memory_id,
          bare.status ?? null,
          bare.confidence ?? null,
          bare.sensitivity ?? null,
          bare.superseded_by ?? null,
          bare.disputed_reason ?? null,
          bare.tombstoned_at ?? null,
          JSON.stringify(bare),
        ],
      );
      await tx.query('DELETE FROM memory_versions WHERE memory_id = $1', [memory_id]);
      for (const v of versions) {
        await tx.query(
          `INSERT INTO memory_versions
             (version_id, memory_id, version_number, change_type, changed_by,
              diff_summary, source_event_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            v.version_id,
            v.memory_id,
            v.version_number,
            v.change_type,
            v.changed_by ?? null,
            v.diff_summary ?? null,
            v.source_event_id ?? null,
            v.created_at,
          ],
        );
      }
    });
  });
}

/** Test-only: wipe every authority table (ordered through the same journal). */
export function truncateAuthority(): void {
  enqueue(async (db) => {
    await db.exec(
      'TRUNCATE memory_registry, memory_versions, memory_sources, contradiction_edges, ledger_events, retrievals;',
    );
  });
}
