import type { MemoryRecord, MemoryVersion } from '@/types/governed';
import { loadRegistry, invalidateRegistry } from './registry';
import { loadOverlay, upsertEntry } from './governance';
import { appendWritten } from './store';
import { logEvent } from '@/lib/ledger/events';

/**
 * Record export / import — contract v0.1 §6 (portability).
 *
 * Export is JSONL, one record per line, **overlay applied**: the exported
 * record reflects governed state (status, confidence, supersession pointers,
 * version history), not raw canonical state. Sensitivity rules are enforced at
 * the boundary: `restricted` never leaves, `sensitive` only on explicit
 * request, tombstones travel as id + event history with no content.
 *
 * Import preserves identity (`memory_id`), provenance (`source_refs`), version
 * history, and status; it is idempotent (re-importing reconciles governance
 * instead of duplicating) and re-runs the local evidence floor, reporting —
 * not silently dropping — records below it.
 *
 * The round-trip law (export → wipe → import → identical retrieve results) is
 * the Portable conformance test: `tests/conformance/portability.test.ts`.
 */

export const RECORD_MARKER = 'memrails.record.v0_1';
export const TOMBSTONE_MARKER = 'memrails.tombstone.v0_1';

const EVIDENCE_FLOOR = 0.75;

export type ExportedRecordLine = MemoryRecord & {
  export: typeof RECORD_MARKER;
  versions: MemoryVersion[];
};

export type ExportedTombstoneLine = {
  export: typeof TOMBSTONE_MARKER;
  memory_id: string;
  status: 'tombstoned';
  tombstoned_at?: string;
  versions: MemoryVersion[];
};

export type ExportOptions = {
  /** Restrict the export to one owner / project; default exports the store. */
  owner_id?: string;
  project_id?: string;
  /** `sensitive` records are withheld unless explicitly requested (§6). */
  include_sensitive?: boolean;
};

export type ExportStats = {
  records: number;
  tombstones: number;
  withheld_restricted: number;
  withheld_sensitive: number;
};

export function exportRecords(opts: ExportOptions = {}): { jsonl: string; stats: ExportStats } {
  const overlay = loadOverlay({ force: true });
  const stats: ExportStats = { records: 0, tombstones: 0, withheld_restricted: 0, withheld_sensitive: 0 };
  const lines: string[] = [];

  for (const record of loadRegistry({ force: true })) {
    if (opts.owner_id && record.scope.owner_id !== opts.owner_id) continue;
    if (opts.project_id && record.scope.project_id !== opts.project_id) continue;

    const versions = overlay[record.memory_id]?.versions ?? [];

    if (record.status === 'tombstoned') {
      // Tombstones travel as id + event history only — no content, no summary.
      const line: ExportedTombstoneLine = {
        export: TOMBSTONE_MARKER,
        memory_id: record.memory_id,
        status: 'tombstoned',
        tombstoned_at: overlay[record.memory_id]?.tombstoned_at,
        versions,
      };
      lines.push(JSON.stringify(line));
      stats.tombstones += 1;
      continue;
    }
    if (record.sensitivity === 'restricted') {
      stats.withheld_restricted += 1;
      continue;
    }
    if (record.sensitivity === 'sensitive' && !opts.include_sensitive) {
      stats.withheld_sensitive += 1;
      continue;
    }

    const line: ExportedRecordLine = { ...record, export: RECORD_MARKER, versions };
    lines.push(JSON.stringify(line));
    stats.records += 1;
  }

  logEvent('MEMORY_EXPORTED', { ...stats, owner_id: opts.owner_id ?? null, project_id: opts.project_id ?? null });
  return { jsonl: lines.map((l) => `${l}\n`).join(''), stats };
}

export type ImportReport = {
  imported: number;
  reconciled: number;
  tombstones_applied: number;
  below_floor: string[];
  errors: number;
};

/**
 * Import a §6 JSONL export. Identity, provenance, versions, and status are
 * preserved; already-present records are reconciled (governance state applied)
 * rather than duplicated; tombstones are honored even for records the target
 * runtime has not (yet) seen — the authority entry outlives the content.
 */
export function importRecords(jsonl: string): ImportReport {
  const report: ImportReport = { imported: 0, reconciled: 0, tombstones_applied: 0, below_floor: [], errors: 0 };
  const existing = new Set(loadRegistry({ force: true }).map((r) => r.memory_id));
  const seenInImport = new Set<string>();

  for (const raw of jsonl.split('\n')) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    let line: ExportedRecordLine | ExportedTombstoneLine;
    try {
      line = JSON.parse(trimmed);
    } catch {
      report.errors += 1;
      continue;
    }

    if (line.export === TOMBSTONE_MARKER) {
      // Honor the tombstone regardless of whether the record exists here yet:
      // the overlay entry is keyed by memory_id and wins if content ever lands.
      upsertEntry(line.memory_id, (cur) => ({
        ...cur,
        status: 'tombstoned',
        tombstoned_at: line.tombstoned_at ?? cur.tombstoned_at ?? new Date().toISOString(),
        versions: line.versions.length > 0 ? line.versions : cur.versions,
      }));
      report.tombstones_applied += 1;
      continue;
    }

    if (line.export !== RECORD_MARKER) {
      report.errors += 1;
      continue;
    }

    const { export: _marker, versions, ...record } = line;
    if (seenInImport.has(record.memory_id)) continue;
    seenInImport.add(record.memory_id);

    // Re-run the local evidence floor (§6): report, never silently drop.
    if (record.confidence < EVIDENCE_FLOOR) {
      report.below_floor.push(record.memory_id);
    }

    const alreadyPresent = existing.has(record.memory_id);
    if (!alreadyPresent) {
      // Identity, provenance, and status travel on the record itself.
      appendWritten(record as MemoryRecord);
      report.imported += 1;
    } else {
      report.reconciled += 1;
    }

    // Governance state (status transitions, confidence overrides, supersession
    // pointers, version history) lands in the authority overlay either way —
    // that is what makes re-import reconcile instead of drift.
    const carriesGovernance =
      versions.length > 0 || record.status !== 'active' || record.superseded_by != null;
    if (carriesGovernance) {
      upsertEntry(record.memory_id, (cur) => ({
        ...cur,
        status: record.status,
        confidence: record.confidence,
        superseded_by: record.superseded_by ?? cur.superseded_by ?? null,
        versions: versions.length > 0 ? versions : cur.versions,
      }));
    }
  }

  invalidateRegistry();
  logEvent('MEMORY_IMPORTED', {
    imported: report.imported,
    reconciled: report.reconciled,
    tombstones_applied: report.tombstones_applied,
    below_floor: report.below_floor.length,
    errors: report.errors,
  });
  return report;
}
