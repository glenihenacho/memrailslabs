import type { MemoryRecord, MemoryStatus, MemoryVersion } from '@/types/governed';
import type { Timeline, TimelineEntry, TimelineInput, TimelineSection } from '@/types/timeline';
import { loadRegistry, DEFAULT_SCOPE } from './registry';
import { getEntry } from './governance';

/**
 * Reconstruct a record's status at system-time `tMs` from its version chain.
 *
 * High-fidelity system time: each record carries `created_at` (when it entered
 * the system) and each lifecycle transition appends a version with its own
 * `created_at`. Replaying the transitions up to `tMs` yields the status the
 * record *had* at that instant — the basis for as-of queries.
 *
 * Returns `'nonexistent'` if the record had not been created yet at `tMs`.
 */
export function statusAsOf(
  record: MemoryRecord,
  versions: MemoryVersion[] | undefined,
  tMs: number,
): MemoryStatus | 'nonexistent' {
  const created = Date.parse(record.created_at);
  if (Number.isNaN(created) || created > tMs) return 'nonexistent';

  let status: MemoryStatus = 'active';
  const ordered = [...(versions ?? [])].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  for (const v of ordered) {
    const vt = Date.parse(v.created_at);
    if (Number.isNaN(vt) || vt > tMs) break;
    switch (v.change_type) {
      case 'SUPERSEDE':
        status = 'superseded';
        break;
      case 'DISPUTE':
        status = 'disputed';
        break;
      case 'TOMBSTONE':
        status = 'tombstoned';
        break;
      case 'RESTORE':
        status = 'active';
        break;
      default:
        break; // CREATE / UPDATE_CONFIDENCE don't change status
    }
  }
  return status;
}

function titleFromPath(path: string): string {
  const last = path.split('/').filter(Boolean).pop() ?? 'root';
  return last
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export type ScopedSelection = {
  records: MemoryRecord[];
  mode: 'window' | 'as_of';
  /** as_of mode: reconstructed status per record at the requested instant. */
  asOf?: Map<string, MemoryStatus>;
};

/**
 * Select the in-scope record slice for a window or as-of instant — the
 * completeness base shared by the timeline and the prompt-compiled view.
 */
export function selectScoped(input: TimelineInput): ScopedSelection {
  const owner_id = input.owner_id ?? DEFAULT_SCOPE.owner_id;
  const project_id = input.project_id;
  const scoped = loadRegistry().filter(
    (r) => r.scope.owner_id === owner_id && (project_id === undefined || r.scope.project_id === project_id),
  );

  if (input.as_of) {
    const t = Date.parse(input.as_of);
    const asOf = new Map<string, MemoryStatus>();
    const records: MemoryRecord[] = [];
    for (const r of scoped) {
      const s = statusAsOf(r, getEntry(r.memory_id)?.versions, t);
      if (s === 'active') {
        asOf.set(r.memory_id, s);
        records.push(r);
      }
    }
    return { records, mode: 'as_of', asOf };
  }

  const fromMs = input.from ? Date.parse(input.from) : Number.NEGATIVE_INFINITY;
  const toMs = input.to ? Date.parse(input.to) : Number.POSITIVE_INFINITY;
  const records = scoped.filter((r) => {
    const c = Date.parse(r.created_at);
    return !Number.isNaN(c) && c >= fromMs && c <= toMs;
  });
  return { records, mode: 'window' };
}

export function toTimelineEntry(record: MemoryRecord, statusAsOfValue?: MemoryStatus): TimelineEntry {
  const versions = getEntry(record.memory_id)?.versions ?? [];
  // `forget` removes from active retrieval but the audit trail is preserved;
  // redact the body in the timeline while keeping the record visible.
  const redacted = record.status === 'tombstoned';
  return {
    memory_id: record.memory_id,
    summary: redacted ? '[forgotten]' : record.summary,
    index_path: record.index_path,
    source_file: record.source_file,
    created_at: record.created_at,
    status: record.status,
    status_as_of: statusAsOfValue,
    version_count: versions.length,
  };
}

function organize(entries: TimelineEntry[]): TimelineSection[] {
  const byPath = new Map<string, TimelineEntry[]>();
  for (const e of entries) {
    const arr = byPath.get(e.index_path) ?? [];
    arr.push(e);
    byPath.set(e.index_path, arr);
  }
  return [...byPath.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, items]) => ({
      path,
      title: titleFromPath(path),
      entries: items.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)),
    }));
}

/**
 * Compile a timeline — the completeness contract. Selects & organizes existing
 * canonical records; never ranks, prunes, budgets, or synthesizes.
 */
export function compileTimeline(input: TimelineInput): Timeline {
  const owner_id = input.owner_id ?? DEFAULT_SCOPE.owner_id;
  const { records, mode, asOf } = selectScoped(input);
  const entries = records.map((r) => toTimelineEntry(r, asOf?.get(r.memory_id)));

  const chronological = [...entries].sort(
    (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
  );

  return {
    scope: { owner_id, project_id: input.project_id },
    contract: 'completeness',
    mode,
    from: input.from,
    to: input.to,
    as_of: input.as_of,
    total: entries.length,
    sections: organize(entries),
    chronological,
    compiled_at: new Date().toISOString(),
  };
}
