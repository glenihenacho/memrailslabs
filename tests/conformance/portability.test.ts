/**
 * Contract v0.1 §6 conformance — the round-trip law.
 *
 * export → wipe → import → identical retrieve results with intact provenance.
 * This test becomes the Portable conformance test once a second runtime
 * exists (conversion phase C7); today it proves the law on one runtime.
 */
import { beforeEach, describe, it, expect } from 'vitest';
import { resetData } from './helpers';
import { retrieve } from '@/lib/memory/retrieve';
import { write } from '@/lib/memory/write';
import { supersede, forget } from '@/lib/memory/lifecycle';
import { getRecord } from '@/lib/memory/registry';
import { getEntry } from '@/lib/memory/governance';
import { exportRecords, importRecords, TOMBSTONE_MARKER } from '@/lib/memory/records';
import type { ContextBundle } from '@/types/bundle';

const PROJECT = 'project_portability_conf';

/** The retrieval-relevant fingerprint of a bundle: what came back and why. */
function fingerprint(bundle: ContextBundle) {
  return {
    memories: bundle.memories
      .map((m) => ({
        memory_id: m.memory_id,
        summary: m.summary,
        confidence: m.confidence,
        status: m.status,
        source_file: m.source_file,
        index_path: m.index_path,
      }))
      .sort((a, b) => a.memory_id.localeCompare(b.memory_id)),
    omitted: [...bundle.omitted].sort((a, b) => a.memory_id.localeCompare(b.memory_id)),
  };
}

const QUERIES = [
  'portability retrieval decision',
  'sensitive deployment credential policy',
  'superseded governance fact',
];

describe('contract §6 — record export / import', () => {
  beforeEach(resetData);

  it('round-trips: export → wipe → import → identical retrieve results, provenance intact', () => {
    // Seed a governed store: plain, sensitive, restricted, low-confidence,
    // a supersession chain, and a tombstone.
    const plain = write({ content: 'Portability decision: records travel as JSONL.', project_id: PROJECT, memory_type: 'decision', tags: ['portability'], confidence: 0.92 });
    const sensitive = write({ content: 'Sensitive deployment credential policy summary.', project_id: PROJECT, sensitivity: 'sensitive', tags: ['policy'], confidence: 0.9 });
    const restricted = write({ content: 'Restricted material that must never be exported.', project_id: PROJECT, sensitivity: 'restricted', tags: ['secret'] });
    const lowConf = write({ content: 'Low-confidence speculation for the floor report.', project_id: PROJECT, confidence: 0.5, tags: ['speculation'] });
    const old = write({ content: 'Superseded governance fact, original version.', project_id: PROJECT, tags: ['governance'], confidence: 0.9 });
    supersede(old.memory_id, {
      new_memory: { content: 'Superseded governance fact, corrected version.', project_id: PROJECT, tags: ['governance'], confidence: 0.95 },
      reason: 'corrected',
    });
    const gone = write({ content: 'Tombstoned fact that stays excluded after import.', project_id: PROJECT, tags: ['tombstone'] });
    forget(gone.memory_id, { reason: 'requested' });

    const before = QUERIES.map((q) =>
      fingerprint(retrieve({ task_context: q, project_id: PROJECT, include_disputed: true })),
    );
    const provenanceBefore = getRecord(plain.memory_id, { force: true })!.source_refs;

    // Export with sensitive included (full-fidelity migration); restricted is
    // withheld unconditionally.
    const { jsonl, stats } = exportRecords({ project_id: PROJECT, include_sensitive: true });
    expect(stats.withheld_restricted).toBe(1);
    expect(jsonl).not.toContain(restricted.memory_id);
    expect(jsonl).not.toContain('never be exported');
    // The tombstone travels as id + events, without content.
    expect(jsonl).toContain(gone.memory_id);
    expect(jsonl).not.toContain('stays excluded after import');

    // Wipe the runtime's mutable stores (the "second runtime" — same contract,
    // empty authority + empty written store).
    resetData();
    expect(getRecord(plain.memory_id, { force: true })).toBeNull();

    const report = importRecords(jsonl);
    expect(report.imported).toBeGreaterThan(0);
    expect(report.errors).toBe(0);
    expect(report.below_floor).toContain(lowConf.memory_id);
    expect(report.tombstones_applied).toBe(1);

    const after = QUERIES.map((q) =>
      fingerprint(retrieve({ task_context: q, project_id: PROJECT, include_disputed: true })),
    );

    // Identical retrieve results (restricted never flowed through retrieval,
    // so its absence cannot show up in a bundle).
    for (let i = 0; i < QUERIES.length; i += 1) {
      const expected = {
        ...before[i],
        // Restricted content never leaves the source runtime and a tombstone
        // travels as id + events only (§6) — neither has content in the target
        // runtime, so their audit omission lines cannot reappear. Everything a
        // caller can actually *receive* is identical.
        omitted: before[i].omitted.filter(
          (o) => o.memory_id !== restricted.memory_id && o.memory_id !== gone.memory_id,
        ),
      };
      expect(after[i]).toEqual(expected);
    }

    // Provenance intact: identity and source_refs survive the trip.
    expect(getRecord(plain.memory_id, { force: true })!.source_refs).toEqual(provenanceBefore);
    // Supersession chain intact.
    const oldAfter = getRecord(old.memory_id, { force: true })!;
    expect(oldAfter.status).toBe('superseded');
    expect(oldAfter.superseded_by).toMatch(/^mem_/);
    // Tombstone honored.
    const bundle = retrieve({ task_context: 'tombstoned fact excluded', project_id: PROJECT });
    expect(bundle.memories.map((m) => m.memory_id)).not.toContain(gone.memory_id);
  });

  it('is idempotent — re-import reconciles instead of duplicating', () => {
    write({ content: 'Idempotence check record.', project_id: PROJECT, confidence: 0.9 });
    const { jsonl } = exportRecords({ project_id: PROJECT });

    const first = importRecords(jsonl);
    expect(first.imported).toBe(0); // everything already present
    expect(first.reconciled).toBeGreaterThan(0);

    const bundle = retrieve({ task_context: 'idempotence check record', project_id: PROJECT });
    expect(bundle.memories.filter((m) => m.summary.includes('Idempotence check')).length).toBe(1);
  });

  it('honors a tombstone for a record the runtime has not seen yet', () => {
    const line = JSON.stringify({
      export: TOMBSTONE_MARKER,
      memory_id: 'mem_never_seen_here',
      status: 'tombstoned',
      versions: [],
    });
    const report = importRecords(`${line}\n`);
    expect(report.tombstones_applied).toBe(1);
    expect(getEntry('mem_never_seen_here')?.status).toBe('tombstoned');
  });
});
