import type { PGlite } from '@electric-sql/pglite';
import type { GovernanceOverlayEntry, MemoryRecord } from '@/types/governed';
import type { LedgerEvent } from '@/types/ledger';
import type { ContextBundle } from '@/types/bundle';
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

/** Querier accepted by the shared transaction bodies (a tx or the db itself). */
type Querier = Pick<PGlite, 'query'>;

async function upsertOverlayTx(tx: Querier, memory_id: string, entry: GovernanceOverlayEntry): Promise<void> {
  const { versions = [], ...bare } = entry;
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
}

async function insertEventTx(tx: Querier, event: LedgerEvent): Promise<void> {
  await tx.query(
    `INSERT INTO ledger_events (event_id, event_type, schema_version, event, created_at)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT (event_id) DO NOTHING`,
    [event.event_id, event.event_type, event.schema_version ?? 1, JSON.stringify(event), event.created_at],
  );
}

/**
 * Upsert one governance overlay entry (no event). Used by plain overlay
 * saves; lifecycle transitions go through {@link persistGovernanceChange}.
 */
export function persistOverlayEntry(memory_id: string, entry: GovernanceOverlayEntry): void {
  enqueue(async (db) => {
    await db.transaction(async (tx) => {
      await upsertOverlayTx(tx as unknown as Querier, memory_id, entry);
    });
  });
}

/**
 * The C3 spine guarantee: a governance change and its ledger event land in
 * **one transaction** — projections rebuilt from the stream can never see a
 * state change without its event or vice versa.
 */
export function persistGovernanceChange(
  memory_id: string,
  entry: GovernanceOverlayEntry,
  event: LedgerEvent,
): void {
  enqueue(async (db) => {
    await db.transaction(async (tx) => {
      const q = tx as unknown as Querier;
      await upsertOverlayTx(q, memory_id, entry);
      await insertEventTx(q, event);
    });
  });
}

/** Standalone (non-governance) event → `ledger_events`. Idempotent by event_id. */
export function persistLedgerEvent(event: LedgerEvent): void {
  enqueue(async (db) => {
    await insertEventTx(db, event);
  });
}

/** Training-corpus row (C5.4): retrieval structure + decisions, no content. */
export type TrainingRow = {
  retrieval_id: string;
  task_context_hash: string;
  mode: string;
  branches: string[];
  scoring: unknown[];
  returned_ids: string[];
  omitted: Array<{ memory_id: string; reason: string }>;
  vector_fallback: boolean;
  /** `name@version` of the planner that planned this retrieval (C6, §9). */
  planner?: string;
  created_at: string;
};

/** Retrieval telemetry: bundle row + training row + its event, one transaction. */
export function persistRetrieval(bundle: ContextBundle, event: LedgerEvent, training?: TrainingRow): void {
  enqueue(async (db) => {
    await db.transaction(async (tx) => {
      const q = tx as unknown as Querier;
      await q.query(
        `INSERT INTO retrievals (retrieval_id, bundle, created_at)
         VALUES ($1, $2, $3) ON CONFLICT (retrieval_id) DO NOTHING`,
        [bundle.retrieval_id, JSON.stringify(bundle), bundle.created_at],
      );
      if (training) {
        await q.query(
          `INSERT INTO retrieval_training
             (retrieval_id, task_context_hash, mode, branches, scoring, returned_ids,
              omitted, vector_fallback, planner, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (retrieval_id) DO NOTHING`,
          [
            training.retrieval_id,
            training.task_context_hash,
            training.mode,
            JSON.stringify(training.branches),
            JSON.stringify(training.scoring),
            JSON.stringify(training.returned_ids),
            JSON.stringify(training.omitted),
            training.vector_fallback,
            training.planner ?? null,
            training.created_at,
          ],
        );
      }
      await insertEventTx(q, event);
    });
  });
}

/** Append a feedback outcome onto the retrieval's training row (C5.4). */
export function persistTrainingOutcome(
  retrieval_id: string,
  outcome: Record<string, unknown>,
): void {
  enqueue(async (db) => {
    await db.query(
      `UPDATE retrieval_training
       SET outcome = COALESCE(outcome, '[]'::jsonb) || $2::jsonb
       WHERE retrieval_id = $1`,
      [retrieval_id, JSON.stringify([outcome])],
    );
  });
}

/** Artifact rail pointer (C4.2): the blob lives content-addressed off-Postgres. */
export type ArtifactPointer = {
  ref: string;
  hash: string;
  owner_id?: string | null;
  bytes: number;
};

export function persistArtifactPointer(ptr: ArtifactPointer): void {
  enqueue(async (db) => {
    await db.query(
      `INSERT INTO artifacts (ref, hash, owner_id, bytes, created_at)
       VALUES ($1, $2, $3, $4, now()) ON CONFLICT (ref) DO NOTHING`,
      [ptr.ref, ptr.hash, ptr.owner_id ?? null, ptr.bytes],
    );
  });
}

/** Test-only: wipe every authority table (ordered through the same journal). */
export function truncateAuthority(): void {
  enqueue(async (db) => {
    await db.exec(
      'TRUNCATE memory_registry, memory_versions, memory_sources, contradiction_edges, ledger_events, ledger_cursors, retrievals, retrieval_training, artifacts;',
    );
  });
}
