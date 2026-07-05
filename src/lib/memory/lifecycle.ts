import { randomUUID } from 'node:crypto';
import type { GovernanceOverlayEntry, MemoryVersion } from '@/types/governed';
import { newEventId } from '@/lib/ledger/events';
import { getRecord, invalidateRegistry } from './registry';
import { upsertEntryWithEvent } from './governance';
import { write, type WriteInput } from './write';

/**
 * Governed lifecycle transitions — supersede / dispute / restore /
 * re-score / forget.
 *
 * Every transition commits through `upsertEntryWithEvent` (C3): the overlay
 * change and its ledger event land as one unit, the version row links back
 * to the event via `source_event_id`, and the event carries the full
 * resulting `overlay_entry` so governance state is exactly rebuildable from
 * the stream (`src/lib/ledger/replay.ts`). One timestamp per transition —
 * version, overlay, and event agree to the millisecond.
 */

function version(
  memory_id: string,
  change_type: MemoryVersion['change_type'],
  diff_summary: string,
  changed_by: string,
  created_at: string,
  source_event_id: string,
): MemoryVersion {
  return {
    version_id: `ver_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
    memory_id,
    version_number: 0, // set on append
    change_type,
    changed_by,
    diff_summary,
    source_event_id,
    created_at,
  };
}

function appendVersion(cur: GovernanceOverlayEntry, v: MemoryVersion): MemoryVersion[] {
  const versions = [...(cur.versions ?? [])];
  v.version_number = versions.length + 1;
  return [...versions, v];
}

/**
 * Supersede: mark the old memory superseded and point it at a replacement.
 * Preserves the evidence chain — the old record is never deleted, just removed
 * from active retrieval (CLAUDE.md Rule 4 + the supersession spec).
 */
export function supersede(
  memory_id: string,
  opts: { new_memory?: WriteInput; new_memory_id?: string; reason?: string; changed_by?: string },
): { superseded: string; replacement: string | null } {
  const existing = getRecord(memory_id);
  if (!existing) throw new Error('memory_not_found');

  let replacement = opts.new_memory_id ?? null;
  if (!replacement && opts.new_memory) {
    replacement = write({
      ...opts.new_memory,
      owner_id: opts.new_memory.owner_id ?? existing.scope.owner_id,
      project_id: opts.new_memory.project_id ?? existing.scope.project_id,
      index_path: opts.new_memory.index_path ?? existing.index_path,
    }).memory_id;
  }

  // A memory can never supersede itself — that would tombstone a live record
  // while pointing it back at itself.
  if (replacement === memory_id) {
    throw new Error('cannot_supersede_with_self');
  }

  const changed_by = opts.changed_by ?? 'system';
  const now = new Date().toISOString();
  const event_id = newEventId();
  const v = version(memory_id, 'SUPERSEDE', opts.reason ?? 'superseded by newer memory', changed_by, now, event_id);

  upsertEntryWithEvent(
    memory_id,
    (cur) => ({ ...cur, status: 'superseded', superseded_by: replacement, versions: appendVersion(cur, v) }),
    (entry) => ({
      type: 'MEMORY_SUPERSEDED',
      metadata: { reason: opts.reason ?? null, replacement, overlay_entry: entry },
      extra: {
        event_id,
        created_at: now,
        memory_id,
        owner_id: existing.scope.owner_id,
        project_id: existing.scope.project_id,
      },
    }),
  );
  invalidateRegistry();

  return { superseded: memory_id, replacement };
}

/**
 * Dispute: flag a memory as contested, drop its confidence, and exclude it from
 * retrieval unless explicitly requested. Original evidence is preserved.
 */
export function dispute(
  memory_id: string,
  opts: { reason: string; changed_by?: string },
): { memory_id: string; status: 'disputed'; confidence: number } {
  const existing = getRecord(memory_id);
  if (!existing) throw new Error('memory_not_found');

  const reducedConfidence = Number((existing.confidence * 0.5).toFixed(3));
  const changed_by = opts.changed_by ?? 'system';
  const now = new Date().toISOString();
  const event_id = newEventId();
  const v = version(memory_id, 'DISPUTE', opts.reason, changed_by, now, event_id);

  upsertEntryWithEvent(
    memory_id,
    (cur) => ({
      ...cur,
      status: 'disputed',
      confidence: reducedConfidence,
      disputed_reason: opts.reason,
      versions: appendVersion(cur, v),
    }),
    (entry) => ({
      type: 'MEMORY_DISPUTED',
      metadata: { reason: opts.reason, confidence: reducedConfidence, overlay_entry: entry },
      extra: {
        event_id,
        created_at: now,
        memory_id,
        owner_id: existing.scope.owner_id,
        project_id: existing.scope.project_id,
      },
    }),
  );
  invalidateRegistry();

  return { memory_id, status: 'disputed', confidence: reducedConfidence };
}

/**
 * Restore: bring a disputed memory back to active retrieval at a stated
 * confidence (defaults to its current one). Completes the dispute cycle —
 * doubt is reversible (contract §4.4), and the reversal is a first-class,
 * versioned, evented transition like every other.
 */
export function restore(
  memory_id: string,
  opts: { confidence?: number; reason?: string; changed_by?: string } = {},
): { memory_id: string; status: 'active'; confidence: number } {
  const existing = getRecord(memory_id);
  if (!existing) throw new Error('memory_not_found');
  if (existing.status !== 'disputed') throw new Error('only_disputed_memory_can_be_restored');

  const confidence = clamp01(opts.confidence ?? existing.confidence);
  const changed_by = opts.changed_by ?? 'system';
  const now = new Date().toISOString();
  const event_id = newEventId();
  const v = version(memory_id, 'RESTORE', opts.reason ?? 'dispute resolved', changed_by, now, event_id);

  upsertEntryWithEvent(
    memory_id,
    (cur) => {
      const { disputed_reason: _cleared, ...rest } = cur;
      return { ...rest, status: 'active', confidence, versions: appendVersion(cur, v) };
    },
    (entry) => ({
      type: 'MEMORY_RESTORED',
      metadata: { reason: opts.reason ?? null, confidence, overlay_entry: entry },
      extra: {
        event_id,
        created_at: now,
        memory_id,
        owner_id: existing.scope.owner_id,
        project_id: existing.scope.project_id,
      },
    }),
  );
  invalidateRegistry();

  return { memory_id, status: 'active', confidence };
}

/**
 * Re-score: update a memory's confidence without a status change (staleness
 * re-verification, telemetry-weighted scoring — the C5 loop writes through
 * here so every re-score is versioned and evented).
 */
export function updateConfidence(
  memory_id: string,
  opts: { confidence: number; reason?: string; changed_by?: string },
): { memory_id: string; confidence: number } {
  const existing = getRecord(memory_id);
  if (!existing) throw new Error('memory_not_found');

  const confidence = clamp01(opts.confidence);
  const changed_by = opts.changed_by ?? 'system';
  const now = new Date().toISOString();
  const event_id = newEventId();
  const v = version(
    memory_id,
    'UPDATE_CONFIDENCE',
    opts.reason ?? `confidence ${existing.confidence} → ${confidence}`,
    changed_by,
    now,
    event_id,
  );

  upsertEntryWithEvent(
    memory_id,
    (cur) => ({ ...cur, confidence, versions: appendVersion(cur, v) }),
    (entry) => ({
      type: 'MEMORY_CONFIDENCE_UPDATED',
      metadata: {
        reason: opts.reason ?? null,
        confidence,
        previous_confidence: existing.confidence,
        overlay_entry: entry,
      },
      extra: {
        event_id,
        created_at: now,
        memory_id,
        owner_id: existing.scope.owner_id,
        project_id: existing.scope.project_id,
      },
    }),
  );
  invalidateRegistry();

  return { memory_id, confidence };
}

/**
 * Forget: remove from active retrieval. Soft by default (tombstone, audit-safe);
 * the canonical body remains until a compliance hard-delete is run.
 */
export function forget(
  memory_id: string,
  opts: { reason?: string; changed_by?: string } = {},
): { memory_id: string; status: 'tombstoned' } {
  const existing = getRecord(memory_id);
  if (!existing) throw new Error('memory_not_found');

  const changed_by = opts.changed_by ?? 'system';
  const now = new Date().toISOString();
  const event_id = newEventId();
  const v = version(memory_id, 'TOMBSTONE', opts.reason ?? 'forget requested', changed_by, now, event_id);

  upsertEntryWithEvent(
    memory_id,
    (cur) => ({ ...cur, status: 'tombstoned', tombstoned_at: now, versions: appendVersion(cur, v) }),
    (entry) => ({
      type: 'MEMORY_DELETED',
      metadata: { reason: opts.reason ?? null, mode: 'tombstone', overlay_entry: entry },
      extra: {
        event_id,
        created_at: now,
        memory_id,
        owner_id: existing.scope.owner_id,
        project_id: existing.scope.project_id,
      },
    }),
  );
  invalidateRegistry();

  return { memory_id, status: 'tombstoned' };
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
