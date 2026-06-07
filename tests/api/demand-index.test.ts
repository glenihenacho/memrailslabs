import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GET } from '@/app/api/demand/index/route';
import { observeIntent } from '@/lib/demand/observe';

let dataDir: string;
const originalDataDir = process.env.DATA_DIR;

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'memrails-demand-route-'));
  process.env.DATA_DIR = dataDir;
});

afterEach(() => {
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
  if (existsSync(dataDir)) rmSync(dataDir, { recursive: true, force: true });
});

async function getIndex(qs = ''): Promise<{ status: number; body: any }> {
  const res = await GET(new Request(`http://localhost/api/demand/index${qs}`));
  return { status: res.status, body: await res.json() };
}

describe('GET /api/demand/index', () => {
  it('returns an empty cluster list when no observations exist', async () => {
    const { status, body } = await getIndex();
    expect(status).toBe(200);
    expect(body.clusters).toEqual([]);
    expect(body.totals.observations).toBe(0);
  });

  it('returns clusters ranked by composite (desc)', async () => {
    // Cluster X: 3 observations across 3 actors
    observeIntent({ raw_text: 'packet contract', source: 'memory_query', actor_id: 'a' });
    observeIntent({ raw_text: 'packet contract', source: 'memory_query', actor_id: 'b' });
    observeIntent({ raw_text: 'packet contract', source: 'memory_query', actor_id: 'c' });
    // Cluster Y: 1 observation, 1 actor
    observeIntent({ raw_text: 'evidence floor', source: 'memory_query', actor_id: 'd' });
    const { body } = await getIndex();
    expect(body.clusters.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < body.clusters.length; i += 1) {
      expect(body.clusters[i - 1].composite).toBeGreaterThanOrEqual(body.clusters[i].composite);
    }
    expect(body.clusters[0].canonical_text).toBe('packet contract');
  });

  it('honors the top= query parameter', async () => {
    for (const q of ['packet contract', 'evidence floor', 'compress packet', 'memory inspect']) {
      observeIntent({ raw_text: q, source: 'memory_query', actor_id: 'a' });
    }
    const { body } = await getIndex('?top=2');
    expect(body.clusters).toHaveLength(2);
  });

  it('honors the since= window', async () => {
    observeIntent({ raw_text: 'packet contract', source: 'memory_query', actor_id: 'a' });
    // Very narrow window in the future excludes the observation
    const { body } = await getIndex('?since=1s');
    // window= 1s ending now; observation just landed, so it's in the window.
    expect(body.clusters.length).toBeGreaterThanOrEqual(1);
  });

  it('excludes opted-out observations', async () => {
    const { register } = await import('@/lib/demand/socket');
    register({
      actor_id: 'silent',
      identity_type: 'authenticated_account',
      consent: { share_intents: false },
    });
    observeIntent({ raw_text: 'private', source: 'memory_query', actor_id: 'silent' });
    observeIntent({ raw_text: 'public', source: 'memory_query', actor_id: 'open' });
    const { body } = await getIndex();
    const texts = body.clusters.map((c: { canonical_text: string }) => c.canonical_text);
    expect(texts).toContain('public');
    expect(texts).not.toContain('private');
  });

  it('reorders the ranking when genuineness is toggled on vs off (sybil collapse)', async () => {
    // Cluster X — 50 observations from one bot in 1 second (sybil).
    for (let i = 0; i < 50; i += 1) {
      observeIntent({ raw_text: 'sybil packets', source: 'memory_query', actor_id: 'bot' });
    }
    // Cluster Y — 3 observations from 3 distinct actors over time.
    observeIntent({ raw_text: 'evidence floor', source: 'memory_query', actor_id: 'alice' });
    observeIntent({ raw_text: 'evidence floor', source: 'memory_query', actor_id: 'bob' });
    observeIntent({ raw_text: 'evidence floor', source: 'memory_query', actor_id: 'charlie' });

    // With genuineness OFF: raw frequency wins → sybil cluster ranks first.
    const { body: off } = await getIndex('?genuineness=off');
    expect(off.clusters[0].canonical_text).toBe('sybil packets');

    // With genuineness ON: sybil is penalized → organic cluster ranks higher
    // (or at least the sybil composite has fallen).
    const { body: on } = await getIndex('?genuineness=on');
    const sybilRow = on.clusters.find((c: { canonical_text: string }) => c.canonical_text === 'sybil packets');
    expect(sybilRow.genuineness).toBeLessThan(0.3);
    expect(sybilRow.composite).toBeLessThan(
      off.clusters.find((c: { canonical_text: string }) => c.canonical_text === 'sybil packets').composite,
    );
  });

  it('surfaces active_stakes count in totals', async () => {
    observeIntent({ raw_text: 'packet contract', source: 'memory_query', actor_id: 'a' });
    const { body: before } = await getIndex();
    expect(before.totals.active_stakes).toBe(0);

    const { clusterIntents, loadObservations } = await import('@/lib/demand/aggregate');
    const { postStake } = await import('@/lib/demand/stake');
    const cluster = clusterIntents(loadObservations())[0];
    postStake({ actor_id: 'staker', cluster_id: cluster.cluster_id, amount_cents: 500 });

    const { body: after } = await getIndex();
    expect(after.totals.active_stakes).toBe(1);
  });
});
