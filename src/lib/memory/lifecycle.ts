import { randomUUID } from 'node:crypto';
import type { MemoryVersion } from '@/types/governed';
import { logEvent } from '@/lib/ledger/events';
import { getRecord, invalidateRegistry } from './registry';
import { upsertEntry } from './governance';
import { write, type WriteInput } from './write';

function version(
  memory_id: string,
  change_type: MemoryVersion['change_type'],
  diff_summary: string,
  changed_by: string,
): MemoryVersion {
  return {
    version_id: `ver_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
    memory_id,
    version_number: 0, // set on append
    change_type,
    changed_by,
    diff_summary,
    created_at: new Date().toISOString(),
  };
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

  const changed_by = opts.changed_by ?? 'system';
  const v = version(memory_id, 'SUPERSEDE', opts.reason ?? 'superseded by newer memory', changed_by);

  upsertEntry(memory_id, (cur) => {
    const versions = [...(cur.versions ?? [])];
    v.version_number = versions.length + 1;
    return { ...cur, status: 'superseded', superseded_by: replacement, versions: [...versions, v] };
  });
  invalidateRegistry();

  logEvent(
    'MEMORY_SUPERSEDED',
    { reason: opts.reason ?? null, replacement },
    { memory_id, owner_id: existing.scope.owner_id, project_id: existing.scope.project_id },
  );

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
  const v = version(memory_id, 'DISPUTE', opts.reason, changed_by);

  upsertEntry(memory_id, (cur) => {
    const versions = [...(cur.versions ?? [])];
    v.version_number = versions.length + 1;
    return {
      ...cur,
      status: 'disputed',
      confidence: reducedConfidence,
      disputed_reason: opts.reason,
      versions: [...versions, v],
    };
  });
  invalidateRegistry();

  logEvent(
    'MEMORY_DISPUTED',
    { reason: opts.reason, confidence: reducedConfidence },
    { memory_id, owner_id: existing.scope.owner_id, project_id: existing.scope.project_id },
  );

  return { memory_id, status: 'disputed', confidence: reducedConfidence };
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
  const v = version(memory_id, 'TOMBSTONE', opts.reason ?? 'forget requested', changed_by);

  upsertEntry(memory_id, (cur) => {
    const versions = [...(cur.versions ?? [])];
    v.version_number = versions.length + 1;
    return {
      ...cur,
      status: 'tombstoned',
      tombstoned_at: new Date().toISOString(),
      versions: [...versions, v],
    };
  });
  invalidateRegistry();

  logEvent(
    'MEMORY_DELETED',
    { reason: opts.reason ?? null, mode: 'tombstone' },
    { memory_id, owner_id: existing.scope.owner_id, project_id: existing.scope.project_id },
  );

  return { memory_id, status: 'tombstoned' };
}
