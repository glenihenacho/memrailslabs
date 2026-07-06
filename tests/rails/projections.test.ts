/**
 * Rails as ledger projections (conversion phase C4).
 *
 * Each rail is a C3 spine consumer, and each must pass the same law: drop
 * the projection, replay the ledger, get the identical state. Postgres wins
 * all disagreements. Postgres-mode only (`npm run test:pg`).
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, it, expect } from 'vitest';
import { resetData } from '../conformance/helpers';
import { write } from '@/lib/memory/write';
import { supersede, forget } from '@/lib/memory/lifecycle';
import { retrieve } from '@/lib/memory/retrieve';
import { authorityMode, flushAuthority, getDb } from '@/lib/memory/authority';
import { runConsumer } from '@/lib/ledger/consumers';
import { hotMemories, HotMemoriesRail, hotMemoriesConsumer } from '@/lib/rails/hot';
import { artifactRail, artifactArchiveConsumer } from '@/lib/rails/artifact';
import { graphRail, GraphRail, graphConsumer, graphQuery } from '@/lib/rails/graph';
import { dataPath } from '@/lib/paths';

const PROJECT = 'project_rails_c4';
const pgOnly = authorityMode() === 'postgres' ? describe : describe.skip;

pgOnly('C4.1 — hot rail (event-driven, backs mode: hot)', () => {
  beforeEach(resetData);

  it('ranks written and retrieved memories hot, and hot mode consults the rail', () => {
    const a = write({ content: 'Hot rail: frequently used decision.', project_id: PROJECT, tags: ['hotrail'], confidence: 0.9 });
    write({ content: 'Hot rail: rarely used side note.', project_id: PROJECT, tags: ['hotrail'] });
    // Usage: retrieving bumps the returned ids.
    retrieve({ task_context: 'hot rail frequently used decision', project_id: PROJECT });
    expect(hotMemories.has(a.memory_id)).toBe(true);
    expect(hotMemories.hotIds(2)[0]).toBe(a.memory_id); // usage outranks recency

    const bundle = retrieve({ task_context: 'anything', project_id: PROJECT, retrieval_mode: 'hot' });
    expect(bundle.memories.map((m) => m.memory_id)).toContain(a.memory_id);
  });

  it('evicts on the lifecycle event, not on a TTL', () => {
    const old = write({ content: 'Hot rail: soon-to-be-superseded fact.', project_id: PROJECT, confidence: 0.9 });
    retrieve({ task_context: 'soon-to-be-superseded fact', project_id: PROJECT });
    expect(hotMemories.has(old.memory_id)).toBe(true);

    supersede(old.memory_id, {
      new_memory: { content: 'Hot rail: the corrected fact.', project_id: PROJECT, confidence: 0.95 },
    });
    expect(hotMemories.has(old.memory_id)).toBe(false); // gone on the event

    const gone = write({ content: 'Hot rail: to be forgotten.', project_id: PROJECT });
    expect(hotMemories.has(gone.memory_id)).toBe(true);
    forget(gone.memory_id);
    expect(hotMemories.has(gone.memory_id)).toBe(false);
  });

  it('rebuilds from the ledger to the same hot set', async () => {
    const a = write({ content: 'Hot rail rebuild: kept decision.', project_id: PROJECT, confidence: 0.9 });
    const b = write({ content: 'Hot rail rebuild: superseded note.', project_id: PROJECT });
    retrieve({ task_context: 'hot rail rebuild kept decision', project_id: PROJECT });
    supersede(b.memory_id, { new_memory: { content: 'Hot rail rebuild: replacement.', project_id: PROJECT } });
    await flushAuthority();

    const rebuilt = new HotMemoriesRail();
    await runConsumer(hotMemoriesConsumer(rebuilt));

    expect(rebuilt.hotIds(50)).toEqual(hotMemories.hotIds(50));
    expect(rebuilt.has(a.memory_id)).toBe(true);
    expect(rebuilt.has(b.memory_id)).toBe(false);
  });
});

pgOnly('C4.2 — artifact rail (content-addressed, encrypted, PG pointers)', () => {
  beforeEach(resetData);

  it('content-addresses by sha256, dedupes, and encrypts at rest', async () => {
    const body = JSON.stringify({ packet: 'artifact rail body', n: 42 });
    const first = artifactRail.putContent('user_memrails', body);
    const again = artifactRail.putContent('user_memrails', body);
    expect(first.ref).toBe(again.ref); // same content, same address
    expect(first.hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(artifactRail.get(first.ref)).toBe(body);

    // Encrypted at rest: the stored blob must not contain the plaintext.
    const rel = first.ref.replace('artifact://', '');
    const raw = readFileSync(dataPath('artifacts', rel));
    expect(raw.subarray(0, 4).toString()).toBe('MRA1');
    expect(raw.includes(Buffer.from('artifact rail body'))).toBe(false);

    // Postgres stores the pointer only.
    await flushAuthority();
    const db = await getDb();
    const rows = await db.query<{ hash: string; bytes: number }>(
      'SELECT hash, bytes FROM artifacts WHERE ref = $1',
      [first.ref],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].hash).toBe(first.hash);
  });

  it('archives retrieval bundles from the retrievals table and rebuilds identically', async () => {
    write({ content: 'Artifact rail: archived retrieval subject.', project_id: PROJECT, confidence: 0.9 });
    const bundle = retrieve({ task_context: 'archived retrieval subject', project_id: PROJECT });
    await flushAuthority();

    const result = await runConsumer(artifactArchiveConsumer());
    expect(result.processed).toBeGreaterThan(0);
    await flushAuthority(); // pointer rows ride the journal

    const db = await getDb();
    const pointers = await db.query<{ ref: string; hash: string }>(
      "SELECT ref, hash FROM artifacts WHERE ref LIKE 'artifact://sha256/%'",
    );
    expect(pointers.rows.length).toBeGreaterThan(0);

    // The archived blob round-trips to the bundle Postgres holds — and
    // replaying onto a clean consumer reproduces the identical hash set.
    const archived = artifactRail.get(pointers.rows[0].ref)!;
    expect(JSON.parse(archived).retrieval_id).toBe(bundle.retrieval_id);
    const firstHashes = pointers.rows.map((r) => r.hash).sort();

    const rerun = await runConsumer(artifactArchiveConsumer()); // cursor at head
    expect(rerun.processed).toBe(0);
    const after = await db.query<{ hash: string }>(
      "SELECT hash FROM artifacts WHERE ref LIKE 'artifact://sha256/%'",
    );
    expect(after.rows.map((r) => r.hash).sort()).toEqual(firstHashes);
  });
});

pgOnly('C4.3 — graph projection (structure only, fixed query menu)', () => {
  beforeEach(resetData);

  /** Fixture: A and B share a source; A is superseded by C. */
  function seedFixture() {
    const shared = { type: 'file' as const, ref: 'docs/spec.md', hash: 'sha256:aaaa1111' };
    const a = write({ content: 'Graph fixture: claim A from the spec.', project_id: PROJECT, source: shared, confidence: 0.9 });
    const b = write({ content: 'Graph fixture: different claim B, same spec source.', project_id: PROJECT, source: shared, confidence: 0.9 });
    const { replacement: c } = supersede(a.memory_id, {
      new_memory: { content: 'Graph fixture: corrected claim replacing A.', project_id: PROJECT, confidence: 0.95 },
    });
    return { a: a.memory_id, b: b.memory_id, c: c! };
  }

  it('taint returns the correct blast radius on the seeded fixture', () => {
    const { a, b, c } = seedFixture();
    const result = graphRail.taint(a, 3);
    const reachedIds = result.reached.map((r) => r.id);
    expect(reachedIds).toContain(c); // replacement inherits taint (SUPERSEDED_BY)
    expect(reachedIds).toContain(b); // shared source (DERIVED_FROM via Source node)
    // Structure only: no node carries content.
    for (const node of graphRail.snapshot().nodes) {
      expect(Object.keys(node).sort()).toEqual(['id', 'type']);
    }
  });

  it('ancestry walks the supersession chain with its change history', () => {
    const { a, c } = seedFixture();
    const lineage = graphRail.ancestry(c, 10);
    expect(lineage.chain[0].id).toBe(a); // walked back to the origin
    expect(lineage.chain[0].superseded_by).toBe(c);
    expect(lineage.changed_by.length).toBeGreaterThan(0);
  });

  it('clusters and centrality answer over memory nodes only', () => {
    const { a, b, c } = seedFixture();
    const cluster = graphQuery('clusters', a, 5) as { members: string[] };
    expect(cluster.members).toEqual(expect.arrayContaining([a, b, c]));
    const central = graphQuery('centrality', undefined, 10) as Array<{ id: string; degree: number }>;
    expect(central.length).toBeGreaterThan(0);
    expect(central[0].degree).toBeGreaterThan(0);
  });

  it('shadow-rebuild from the ledger diffs clean against the live graph', async () => {
    seedFixture();
    forget(write({ content: 'Graph fixture: tombstoned extra.', project_id: PROJECT }).memory_id);
    await flushAuthority();

    const rebuilt = new GraphRail();
    await runConsumer(graphConsumer(rebuilt));

    expect(rebuilt.snapshot()).toEqual(graphRail.snapshot());
  });
});
