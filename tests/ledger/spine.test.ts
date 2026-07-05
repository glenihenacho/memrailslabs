/**
 * Ledger as event spine (conversion phase C3).
 *
 * Proves the three properties every C4 rail depends on:
 *   1. a governance change and its event land transactionally, linked by
 *      version.source_event_id;
 *   2. replay from zero reconstructs governance state exactly;
 *   3. consumers are cursor-tracked and idempotent by event_id.
 *
 * Postgres-mode only (`npm run test:pg`); the file backend's ledger is
 * behaviorally identical but has no spine infrastructure.
 */
import { beforeEach, describe, it, expect } from 'vitest';
import { resetData } from '../conformance/helpers';
import { write } from '@/lib/memory/write';
import { supersede, dispute, restore, updateConfidence, forget } from '@/lib/memory/lifecycle';
import { retrieve } from '@/lib/memory/retrieve';
import { loadOverlay } from '@/lib/memory/governance';
import { exportRecords, importRecords } from '@/lib/memory/records';
import { authorityMode, flushAuthority, getDb } from '@/lib/memory/authority';
import { readLedger } from '@/lib/ledger/events';
import { replayGovernance, rebuildOverlayFromLedger } from '@/lib/ledger/replay';
import { runConsumer, resetConsumerCursor, noopReplayer } from '@/lib/ledger/consumers';

const PROJECT = 'project_ledger_spine';
const pgOnly = authorityMode() === 'postgres' ? describe : describe.skip;

/** Seed one of every lifecycle transition through the public interface. */
function seedGovernance() {
  const old = write({ content: 'Spine: fact due for supersession.', project_id: PROJECT, confidence: 0.9 });
  supersede(old.memory_id, {
    new_memory: { content: 'Spine: corrected fact.', project_id: PROJECT, confidence: 0.95 },
    reason: 'corrected',
  });
  const contested = write({ content: 'Spine: contested claim.', project_id: PROJECT, confidence: 0.9 });
  dispute(contested.memory_id, { reason: 'contested by benchmark' });
  const restored = write({ content: 'Spine: disputed then restored claim.', project_id: PROJECT, confidence: 0.88 });
  dispute(restored.memory_id, { reason: 'briefly contested' });
  restore(restored.memory_id, { confidence: 0.85, reason: 'benchmark rerun cleared it' });
  const rescored = write({ content: 'Spine: re-scored note.', project_id: PROJECT, confidence: 0.8 });
  updateConfidence(rescored.memory_id, { confidence: 0.93, reason: 'verified against source' });
  const gone = write({ content: 'Spine: forgotten note.', project_id: PROJECT });
  forget(gone.memory_id, { reason: 'cleanup' });
  return { old, contested, restored, rescored, gone };
}

pgOnly('C3 — ledger as event spine', () => {
  beforeEach(resetData);

  it('lands a governance change and its event in one transaction, linked by source_event_id', async () => {
    const created = write({ content: 'Spine: transactional check.', project_id: PROJECT, confidence: 0.9 });
    dispute(created.memory_id, { reason: 'checking the spine' });
    await flushAuthority();

    const db = await getDb();
    const events = await db.query<{ event_id: string; event: { metadata: { overlay_entry: unknown } } }>(
      "SELECT event_id, event FROM ledger_events WHERE event_type = 'MEMORY_DISPUTED'",
    );
    expect(events.rows).toHaveLength(1);
    expect(events.rows[0].event.metadata.overlay_entry).toBeDefined();

    // The version row points back at exactly this event.
    const versions = await db.query<{ source_event_id: string }>(
      "SELECT source_event_id FROM memory_versions WHERE memory_id = $1 AND change_type = 'DISPUTE'",
      [created.memory_id],
    );
    expect(versions.rows[0].source_event_id).toBe(events.rows[0].event_id);

    // And the overlay agrees with the event payload — same transaction, same truth.
    expect(loadOverlay()[created.memory_id]).toEqual(events.rows[0].event.metadata.overlay_entry);
  });

  it('rebuilds governance state exactly by replaying the ledger from zero', async () => {
    seedGovernance();
    await flushAuthority();

    const live = loadOverlay();
    const replayed = await rebuildOverlayFromLedger();

    // JSON round-trip normalizes undefined fields the way persistence does.
    expect(JSON.parse(JSON.stringify(replayed))).toEqual(JSON.parse(JSON.stringify(live)));
    expect(Object.keys(replayed).length).toBeGreaterThanOrEqual(5);
  });

  it('replays imported governance the same as native governance', async () => {
    seedGovernance();
    await flushAuthority();
    const { jsonl } = exportRecords({ project_id: PROJECT, include_sensitive: true });

    // Fresh runtime: import, then prove the ledger alone reproduces the overlay.
    resetData();
    importRecords(jsonl);
    await flushAuthority();

    const live = loadOverlay();
    const replayed = await rebuildOverlayFromLedger();
    expect(JSON.parse(JSON.stringify(replayed))).toEqual(JSON.parse(JSON.stringify(live)));
  });

  it('consumers are cursor-tracked and idempotent by event_id', async () => {
    seedGovernance();
    retrieve({ task_context: 'spine corrected fact', project_id: PROJECT });
    await flushAuthority();

    const total = (await readLedger()).length;
    expect(total).toBeGreaterThan(5);

    const replayer = noopReplayer('test_replayer');
    const first = await runConsumer(replayer);
    expect(first.processed).toBe(total);
    expect(first.to_seq).toBeGreaterThan(first.from_seq);

    // Head reached: a re-run consumes nothing new.
    const second = await runConsumer(replayer);
    expect(second.processed).toBe(0);
    expect(second.from_seq).toBe(first.to_seq);

    // New events resume from the cursor, not from zero.
    forget(write({ content: 'Spine: post-cursor write.', project_id: PROJECT }).memory_id);
    await flushAuthority();
    const third = await runConsumer(replayer);
    expect(third.processed).toBeGreaterThan(0);
    expect(third.from_seq).toBe(first.to_seq);

    // Determinism: a cursor reset replays the identical stream.
    const fresh = noopReplayer('test_replayer_fresh');
    await runConsumer(fresh);
    await resetConsumerCursor('test_replayer_fresh');
    const rerun = noopReplayer('test_replayer_fresh');
    await runConsumer(rerun);
    expect(rerun.events.map((e) => e.event_id)).toEqual(fresh.events.map((e) => e.event_id));
    expect(replayGovernance(rerun.events)).toEqual(replayGovernance(fresh.events));
  });

  it('restore and re-score behave as governed transitions', () => {
    const m = write({ content: 'Spine: restore semantics.', project_id: PROJECT, confidence: 0.9 });
    dispute(m.memory_id, { reason: 'contested' });
    expect(retrieve({ task_context: 'restore semantics', project_id: PROJECT }).memories.map((x) => x.memory_id)).not.toContain(m.memory_id);

    const restored = restore(m.memory_id, { confidence: 0.9 });
    expect(restored.status).toBe('active');
    expect(retrieve({ task_context: 'restore semantics', project_id: PROJECT }).memories.map((x) => x.memory_id)).toContain(m.memory_id);

    const rescored = updateConfidence(m.memory_id, { confidence: 0.7 });
    expect(rescored.confidence).toBe(0.7);
    // Only disputed memory can be restored.
    expect(() => restore(m.memory_id)).toThrow();
  });
});
