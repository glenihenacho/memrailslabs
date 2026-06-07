import { describe, expect, it } from 'vitest';
import { genuinenessFor } from '@/lib/demand/genuineness';
import type { IntentCluster, IntentObservation, IntentStake } from '@/types/demand';

const BASE_TIME = Date.parse('2026-06-01T00:00:00.000Z');

function obs(
  intent_id: string,
  actor_id: string,
  offsetMs: number,
  identity: 'anonymous_fingerprint' | 'authenticated_account' = 'anonymous_fingerprint',
): IntentObservation {
  return {
    _v: 1,
    intent_id,
    normalized_text: 'packet contract',
    raw_text: 'packet contract',
    content_hash: 'h1',
    actor_id,
    identity_type: identity,
    source: 'memory_query',
    consent_share: true,
    observed_at: new Date(BASE_TIME + offsetMs).toISOString(),
  };
}

function clusterFrom(observations: IntentObservation[], cluster_id = 'tic_test'): IntentCluster {
  const actor_ids = Array.from(new Set(observations.map((o) => o.actor_id))).sort();
  return {
    cluster_id,
    canonical_text: 'packet contract',
    observation_ids: observations.map((o) => o.intent_id),
    actor_ids,
    identity_mix: {
      authenticated: actor_ids.filter(
        (id) => observations.find((o) => o.actor_id === id)?.identity_type === 'authenticated_account',
      ).length,
      anonymous: actor_ids.filter(
        (id) => observations.find((o) => o.actor_id === id)?.identity_type === 'anonymous_fingerprint',
      ).length,
    },
    first_observed: observations[0]?.observed_at ?? '',
    last_observed: observations[observations.length - 1]?.observed_at ?? '',
  };
}

describe('genuinenessFor() — sybil/burst detection', () => {
  it('collapses below 0.3 for 100 observations from a single actor in 5 seconds', () => {
    // 100 observations evenly spaced over 5s from one actor
    const observations = Array.from({ length: 100 }, (_, i) => obs(`t${i}`, 'bot', i * 50));
    const cluster = clusterFrom(observations);
    const g = genuinenessFor(cluster, observations);
    expect(g).toBeLessThan(0.3);
  });

  it('stays near 1.0 for an organically distributed cluster (5 actors, 10 obs, 30 min)', () => {
    const observations: IntentObservation[] = [];
    for (let i = 0; i < 10; i += 1) {
      const actor = `actor_${i % 5}`;
      observations.push(obs(`t${i}`, actor, i * 180_000)); // every 3 min
    }
    const cluster = clusterFrom(observations);
    const g = genuinenessFor(cluster, observations);
    expect(g).toBeGreaterThan(0.95);
  });

  it('does not penalize a single legitimate query from one actor', () => {
    const observations = [obs('t1', 'a', 0)];
    const g = genuinenessFor(clusterFrom(observations), observations);
    expect(g).toBeGreaterThanOrEqual(0.99);
  });

  it('penalty fires when BOTH dominance and burst rate are high', () => {
    // 50% from one actor but spread over 30 min — no burst, no penalty
    const slow: IntentObservation[] = [];
    for (let i = 0; i < 10; i += 1) {
      slow.push(obs(`t${i}`, i < 5 ? 'a' : 'b', i * 180_000));
    }
    const gSlow = genuinenessFor(clusterFrom(slow), slow);

    // Same 10 obs but 5-from-actor-a happen in 1s → burst
    const burst: IntentObservation[] = [];
    for (let i = 0; i < 5; i += 1) burst.push(obs(`t${i}`, 'a', i * 200));
    for (let i = 5; i < 10; i += 1) burst.push(obs(`t${i}`, 'b', 60_000 + (i - 5) * 200));
    const gBurst = genuinenessFor(clusterFrom(burst), burst);

    expect(gSlow).toBeGreaterThan(gBurst);
  });
});

describe('genuinenessFor() — stake lift', () => {
  it('raises genuineness when an active stake is posted on the cluster', () => {
    const observations = [obs('t1', 'a', 0), obs('t2', 'b', 60_000), obs('t3', 'c', 120_000)];
    const cluster = clusterFrom(observations, 'tic_real');
    const baseline = genuinenessFor(cluster, observations);
    const stakes: IntentStake[] = [
      {
        stake_id: 'stk_1',
        actor_id: 'a',
        cluster_id: 'tic_real',
        amount_cents: 10_000,
        status: 'active',
        created_at: '2026-06-01T00:00:00.000Z',
        updated_at: '2026-06-01T00:00:00.000Z',
      },
    ];
    const lifted = genuinenessFor(cluster, observations, stakes);
    expect(lifted).toBeGreaterThan(baseline);
  });

  it('caps stake lift at +0.5 (so genuineness ≤ ~1.5)', () => {
    const observations = [obs('t1', 'a', 0)];
    const cluster = clusterFrom(observations, 'tic_x');
    const stakes: IntentStake[] = [
      {
        stake_id: 'stk_huge',
        actor_id: 'a',
        cluster_id: 'tic_x',
        amount_cents: 1_000_000_000,
        status: 'active',
        created_at: '2026-06-01T00:00:00.000Z',
        updated_at: '2026-06-01T00:00:00.000Z',
      },
    ];
    const g = genuinenessFor(cluster, observations, stakes);
    expect(g).toBeLessThanOrEqual(1.5);
  });

  it('only counts stakes on the matching cluster_id', () => {
    const observations = [obs('t1', 'a', 0)];
    const cluster = clusterFrom(observations, 'tic_target');
    const stakesOther: IntentStake[] = [
      {
        stake_id: 'stk_other',
        actor_id: 'a',
        cluster_id: 'tic_unrelated',
        amount_cents: 10_000,
        status: 'active',
        created_at: '2026-06-01T00:00:00.000Z',
        updated_at: '2026-06-01T00:00:00.000Z',
      },
    ];
    const baseline = genuinenessFor(cluster, observations);
    const withWrongStake = genuinenessFor(cluster, observations, stakesOther);
    expect(withWrongStake).toBeCloseTo(baseline, 6);
  });
});

describe('genuinenessFor() — slash drag', () => {
  it('drops when observations are contributed by actors with slashed stakes', () => {
    const observations = [obs('t1', 'naughty', 0), obs('t2', 'clean', 60_000), obs('t3', 'clean', 120_000)];
    const cluster = clusterFrom(observations, 'tic_drag');
    const baseline = genuinenessFor(cluster, observations);
    const stakes: IntentStake[] = [
      {
        stake_id: 'stk_slashed',
        actor_id: 'naughty',
        cluster_id: 'tic_other',
        amount_cents: 100,
        status: 'slashed',
        reason_if_slashed: 'sybil',
        created_at: '2026-06-01T00:00:00.000Z',
        updated_at: '2026-06-01T00:00:00.000Z',
      },
    ];
    const dragged = genuinenessFor(cluster, observations, stakes);
    expect(dragged).toBeLessThan(baseline);
  });
});
