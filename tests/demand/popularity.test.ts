import { describe, expect, it } from 'vitest';
import { rank, score } from '@/lib/demand/popularity';
import type { IntentCluster, IntentObservation, Window } from '@/types/demand';

const WINDOW: Window = {
  since: '2026-06-01T00:00:00.000Z',
  until: '2026-06-01T01:00:00.000Z', // 1 hour = 3600s
};

function obs(
  intent_id: string,
  actor_id: string,
  offsetSec: number,
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
    observed_at: new Date(Date.parse(WINDOW.since) + offsetSec * 1000).toISOString(),
  };
}

function clusterFrom(observations: IntentObservation[]): IntentCluster {
  const actor_ids = Array.from(new Set(observations.map((o) => o.actor_id))).sort();
  return {
    cluster_id: 'tic_test',
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

describe('popularity.score()', () => {
  it('computes frequency as observations / window_duration_seconds', () => {
    const obs1 = [obs('t1', 'a', 0), obs('t2', 'a', 100), obs('t3', 'a', 200)];
    const c = clusterFrom(obs1);
    const s = score(c, obs1, { window: WINDOW });
    expect(s.observations).toBe(3);
    expect(s.frequency).toBeCloseTo(3 / 3600, 6);
  });

  it('produces positive velocity when observations skew to the second half', () => {
    const obs1 = [
      obs('t1', 'a', 100), // first half
      obs('t2', 'a', 3000), // second half
      obs('t3', 'a', 3200),
      obs('t4', 'a', 3400),
    ];
    const c = clusterFrom(obs1);
    const s = score(c, obs1, { window: WINDOW });
    expect(s.velocity).toBeGreaterThan(0); // 3 in second half, 1 in first
  });

  it('produces negative velocity when observations skew to the first half', () => {
    const obs1 = [
      obs('t1', 'a', 100),
      obs('t2', 'a', 200),
      obs('t3', 'a', 300),
      obs('t4', 'a', 3000),
    ];
    const c = clusterFrom(obs1);
    const s = score(c, obs1, { window: WINDOW });
    expect(s.velocity).toBeLessThan(0);
  });

  it('weights authenticated breadth higher than anonymous (1.0 vs 0.4)', () => {
    const authObs = [obs('t1', 'a1', 0, 'authenticated_account')];
    const anonObs = [obs('t2', 'a2', 0, 'anonymous_fingerprint')];
    const authS = score(clusterFrom(authObs), authObs, { window: WINDOW });
    const anonS = score(clusterFrom(anonObs), anonObs, { window: WINDOW });
    expect(authS.breadth).toBe(1.0);
    expect(anonS.breadth).toBe(0.4);
  });

  it('breadth grows with distinct actor count', () => {
    const single = [obs('t1', 'a', 0), obs('t2', 'a', 100), obs('t3', 'a', 200)];
    const multi = [obs('t1', 'a', 0), obs('t2', 'b', 100), obs('t3', 'c', 200)];
    const sSingle = score(clusterFrom(single), single, { window: WINDOW });
    const sMulti = score(clusterFrom(multi), multi, { window: WINDOW });
    expect(sMulti.breadth).toBeGreaterThan(sSingle.breadth);
  });

  it('genuineness defaults to 1.0; override is honored', () => {
    const obs1 = [obs('t1', 'a', 0)];
    const c = clusterFrom(obs1);
    const dflt = score(c, obs1, { window: WINDOW });
    const cut = score(c, obs1, { window: WINDOW, genuineness: 0.2 });
    expect(dflt.genuineness).toBe(1.0);
    expect(cut.genuineness).toBe(0.2);
    expect(cut.composite).toBeCloseTo(dflt.composite * 0.2, 6);
  });
});

describe('popularity.rank()', () => {
  it('sorts descending by composite', () => {
    const obsA = [obs('a1', 'p', 0), obs('a2', 'q', 100), obs('a3', 'r', 200)];
    const obsB = [obs('b1', 'p', 0)];
    const sA = score(clusterFrom(obsA), obsA, { window: WINDOW });
    const sB = score(clusterFrom(obsB), obsB, { window: WINDOW });
    const ranked = rank([sB, sA]);
    expect(ranked[0].cluster_id).toBe(sA.cluster_id);
  });

  it('is pure (does not mutate input)', () => {
    const obs1 = [obs('t1', 'a', 0)];
    const s = [score(clusterFrom(obs1), obs1, { window: WINDOW })];
    const original = [...s];
    rank(s);
    expect(s).toEqual(original);
  });
});
