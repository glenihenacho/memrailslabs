import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clusterIntents, loadObservations } from '@/lib/demand/aggregate';
import { observeIntent } from '@/lib/demand/observe';
import { register } from '@/lib/demand/socket';

let dataDir: string;
const originalDataDir = process.env.DATA_DIR;

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'memrails-aggregate-'));
  process.env.DATA_DIR = dataDir;
});

afterEach(() => {
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
  if (existsSync(dataDir)) rmSync(dataDir, { recursive: true, force: true });
});

describe('loadObservations()', () => {
  it('returns [] when no JSONL exists', () => {
    expect(loadObservations()).toEqual([]);
  });

  it('reads JSONL lines back as IntentObservation', () => {
    observeIntent({ raw_text: 'packet contract', source: 'memory_query', actor_id: 'a' });
    observeIntent({ raw_text: 'evidence floor', source: 'memory_query', actor_id: 'b' });
    const all = loadObservations();
    expect(all).toHaveLength(2);
    expect(all.map((o) => o.actor_id).sort()).toEqual(['a', 'b']);
  });

  it('filters by [since, until] window', () => {
    observeIntent({ raw_text: 'old', source: 'memory_query', actor_id: 'a' });
    const since = new Date(Date.now() + 60_000);
    expect(loadObservations({ since })).toHaveLength(0);
  });

  it('excludes opted-out observations by default', () => {
    register({
      actor_id: 'silent',
      identity_type: 'authenticated_account',
      consent: { share_intents: false },
    });
    observeIntent({ raw_text: 'private query', source: 'memory_query', actor_id: 'silent' });
    observeIntent({ raw_text: 'public query', source: 'memory_query', actor_id: 'open' });
    const consenting = loadObservations();
    expect(consenting.map((o) => o.actor_id)).toEqual(['open']);
    const all = loadObservations({ consenting_only: false });
    expect(all.map((o) => o.actor_id).sort()).toEqual(['open', 'silent']);
  });
});

describe('clusterIntents()', () => {
  it('groups identical-hash observations into one cluster', () => {
    observeIntent({ raw_text: 'packet contract', source: 'memory_query', actor_id: 'a' });
    observeIntent({ raw_text: 'Packet Contract', source: 'memory_query', actor_id: 'b' });
    observeIntent({ raw_text: 'packet contracts', source: 'memory_query', actor_id: 'c' });
    const clusters = clusterIntents(loadObservations());
    expect(clusters).toHaveLength(1);
    expect(clusters[0].actor_ids.sort()).toEqual(['a', 'b', 'c']);
    expect(clusters[0].observation_ids).toHaveLength(3);
  });

  it('merges near-duplicate clusters via token-set Jaccard ≥ 0.6', () => {
    // Different content_hashes but high token overlap → one cluster.
    observeIntent({ raw_text: 'compress packet', source: 'memory_query', actor_id: 'a' });
    observeIntent({ raw_text: 'compress packet fast', source: 'memory_query', actor_id: 'b' });
    const clusters = clusterIntents(loadObservations());
    expect(clusters).toHaveLength(1);
    expect(clusters[0].observation_ids).toHaveLength(2);
  });

  it('keeps unrelated queries separate', () => {
    observeIntent({ raw_text: 'packet contract', source: 'memory_query', actor_id: 'a' });
    observeIntent({ raw_text: 'evidence floor confidence', source: 'memory_query', actor_id: 'b' });
    const clusters = clusterIntents(loadObservations());
    expect(clusters).toHaveLength(2);
  });

  it('picks the most-frequent raw_text variant as canonical', () => {
    observeIntent({ raw_text: 'packet contract', source: 'memory_query', actor_id: 'a' });
    observeIntent({ raw_text: 'packet contract', source: 'memory_query', actor_id: 'b' });
    observeIntent({ raw_text: 'Packet Contract', source: 'memory_query', actor_id: 'c' });
    const clusters = clusterIntents(loadObservations());
    expect(clusters[0].canonical_text).toBe('packet contract');
  });

  it('counts identity_mix from observation identity_type', () => {
    register({ actor_id: 'auth_user', identity_type: 'authenticated_account' });
    observeIntent({ raw_text: 'packet contract', source: 'memory_query', actor_id: 'auth_user' });
    observeIntent({ raw_text: 'packet contract', source: 'memory_query' }); // anon
    const clusters = clusterIntents(loadObservations());
    expect(clusters[0].identity_mix.authenticated).toBe(1);
    expect(clusters[0].identity_mix.anonymous).toBe(1);
  });

  it('produces deterministic cluster_ids across runs', () => {
    observeIntent({ raw_text: 'packet contract', source: 'memory_query', actor_id: 'a' });
    const first = clusterIntents(loadObservations())[0].cluster_id;
    observeIntent({ raw_text: 'packet contract', source: 'memory_query', actor_id: 'b' });
    const second = clusterIntents(loadObservations())[0].cluster_id;
    expect(second).toBe(first);
  });
});
