import type { GovernanceOverlay, GovernanceOverlayEntry, MemoryRecord, MemoryVersion } from '@/types/governed';
import type { LedgerEvent } from '@/types/ledger';
import { getDb } from './client';
import { authorityMode } from './mode';
import {
  persistGovernanceChange,
  persistOverlayEntry,
  persistWrittenRecord,
  truncateAuthority,
} from './persist';

/**
 * In-process read replica of the Postgres authority.
 *
 * The kernel's read seams (`readWritten`, `loadOverlay`) are synchronous;
 * Postgres access is not. In `postgres` mode this snapshot is hydrated once
 * per process (`ensureAuthorityReady()`), synchronous reads serve from it,
 * and synchronous writes update it immediately while the serial journal
 * (`persist.ts`) makes them durable. Postgres remains the system of record:
 * a fresh process rebuilds this snapshot entirely from the tables — that is
 * what `tests/authority` proves.
 */

type Snapshot = {
  written: MemoryRecord[];
  overlay: GovernanceOverlay;
  hydrated: boolean;
};

const snapshot: Snapshot = { written: [], overlay: {}, hydrated: false };
let hydrating: Promise<void> | null = null;

async function hydrate(): Promise<void> {
  const db = await getDb();
  const [records, versions] = await Promise.all([
    db.query<{ memory_id: string; record: MemoryRecord | null; overlay: GovernanceOverlayEntry | null }>(
      'SELECT memory_id, record, overlay FROM memory_registry ORDER BY created_at, memory_id',
    ),
    db.query<MemoryVersion>(
      'SELECT version_id, memory_id, version_number, change_type, changed_by, diff_summary, source_event_id, created_at FROM memory_versions ORDER BY memory_id, version_number',
    ),
  ]);

  const versionsById = new Map<string, MemoryVersion[]>();
  for (const v of versions.rows) {
    const list = versionsById.get(v.memory_id) ?? [];
    list.push({
      ...v,
      changed_by: v.changed_by ?? 'system',
      diff_summary: v.diff_summary ?? '',
      source_event_id: v.source_event_id ?? undefined,
      created_at: new Date(v.created_at).toISOString(),
    });
    versionsById.set(v.memory_id, list);
  }

  const written: MemoryRecord[] = [];
  const overlay: GovernanceOverlay = {};
  for (const row of records.rows) {
    if (row.record) written.push(row.record);
    const vs = versionsById.get(row.memory_id);
    if (row.overlay || vs) {
      overlay[row.memory_id] = { ...(row.overlay ?? {}), ...(vs ? { versions: vs } : {}) };
    }
  }

  snapshot.written = written;
  snapshot.overlay = overlay;
  snapshot.hydrated = true;
}

/**
 * Idempotent bootstrap. In `file` mode this is a no-op; in `postgres` (and
 * `dual`) mode it opens the database and hydrates the snapshot. Entrypoints
 * (CLI, MCP dispatcher, API routes, test setup) await this before the first
 * synchronous read.
 */
export async function ensureAuthorityReady(): Promise<void> {
  if (authorityMode() === 'file') return;
  if (snapshot.hydrated) return;
  if (!hydrating) hydrating = hydrate();
  await hydrating;
}

function assertHydrated(): void {
  if (!snapshot.hydrated) {
    throw new Error(
      'authority_not_hydrated: call ensureAuthorityReady() before reading in postgres mode',
    );
  }
}

export function snapshotReadWritten(): MemoryRecord[] {
  assertHydrated();
  return snapshot.written;
}

export function snapshotAppendWritten(record: MemoryRecord): void {
  assertHydrated();
  snapshot.written.push(record);
  persistWrittenRecord(record);
}

export function snapshotLoadOverlay(): GovernanceOverlay {
  assertHydrated();
  return snapshot.overlay;
}

export function snapshotSaveOverlay(overlay: GovernanceOverlay): void {
  assertHydrated();
  snapshot.overlay = overlay;
  for (const [memory_id, entry] of Object.entries(overlay)) {
    persistOverlayEntry(memory_id, entry);
  }
}

/** Targeted upsert — one entry changed, one row persisted. */
export function snapshotUpsertOverlayEntry(memory_id: string, entry: GovernanceOverlayEntry): void {
  assertHydrated();
  snapshot.overlay = { ...snapshot.overlay, [memory_id]: entry };
  persistOverlayEntry(memory_id, entry);
}

/** C3: governance change + its ledger event, committed in one transaction. */
export function snapshotUpsertOverlayEntryWithEvent(
  memory_id: string,
  entry: GovernanceOverlayEntry,
  event: LedgerEvent,
): void {
  assertHydrated();
  snapshot.overlay = { ...snapshot.overlay, [memory_id]: entry };
  persistGovernanceChange(memory_id, entry, event);
}

/**
 * Test reset: clear the snapshot synchronously and enqueue the table
 * truncate. The journal is strictly ordered, so the truncate lands before
 * any write a later test enqueues.
 */
export function resetAuthorityForTests(): void {
  if (authorityMode() === 'file') return;
  snapshot.written = [];
  snapshot.overlay = {};
  snapshot.hydrated = true;
  hydrating = Promise.resolve();
  truncateAuthority();
}

/** Test-only: drop the snapshot so the next ensureAuthorityReady() re-hydrates. */
export function dropSnapshotForTests(): void {
  snapshot.written = [];
  snapshot.overlay = {};
  snapshot.hydrated = false;
  hydrating = null;
}
