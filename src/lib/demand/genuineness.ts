import type { IntentCluster, IntentObservation, IntentStake } from '@/types/demand';

const SYBIL_PENALTY_STRENGTH = 0.85;
const BURST_RATE_FLOOR_QPS = 1.0;
const STAKE_LIFT_CAP = 0.5;
const STAKE_LIFT_LOG_DIVISOR = 10;
const SLASH_DRAG_FACTOR = 0.5;
const GENUINENESS_FLOOR = 0;
const GENUINENESS_CEILING = 1.5;

/**
 * Returns a multiplier in [0, 1.5] applied to the composite score.
 *
 *   1.0  — clean cluster, no penalties, no stake.
 *  <0.3  — single-actor burst (e.g., 100 queries in 5s).
 *  <1.0  — single-actor dominance without a tight burst; partial slash drag.
 *  >1.0  — active stake on the cluster lifts above 1.0.
 *
 * Phase 4 implements three signals:
 *  - sybil signal       = dominance × burstRate, combined penalty.
 *  - stake lift         = log10(amount_cents + 1) / 10, capped at +0.5.
 *  - slash drag         = fraction of observations from actors with slashed
 *                         stakes, multiplied by SLASH_DRAG_FACTOR.
 *
 * Pure function: no I/O. The route/CLI passes in the cluster's observations
 * and the relevant stakes; the genuineness value is then injected into the
 * popularity scorer via `score(cluster, obs, { genuineness })`.
 */
export function genuinenessFor(
  cluster: IntentCluster,
  observations: IntentObservation[],
  stakes: IntentStake[] = [],
): number {
  const inCluster = observations.filter((o) => cluster.observation_ids.includes(o.intent_id));
  if (inCluster.length === 0) return 1.0;

  const sybilSignal = computeSybilSignal(inCluster);
  let genuineness = 1.0 - SYBIL_PENALTY_STRENGTH * sybilSignal;

  // Stake lift — active stake on this cluster adds skin-in-the-game.
  const activeStake = stakes
    .filter((s) => s.cluster_id === cluster.cluster_id && s.status === 'active')
    .reduce((sum, s) => sum + s.amount_cents, 0);
  if (activeStake > 0) {
    const lift = Math.min(STAKE_LIFT_CAP, Math.log10(activeStake + 1) / STAKE_LIFT_LOG_DIVISOR);
    genuineness += lift;
  }

  // Slash drag — observations contributed by actors with slashed stakes
  // pull the cluster down.
  const slashedActors = new Set(
    stakes.filter((s) => s.status === 'slashed').map((s) => s.actor_id),
  );
  if (slashedActors.size > 0) {
    const slashedShare =
      inCluster.filter((o) => slashedActors.has(o.actor_id)).length / inCluster.length;
    genuineness *= 1 - SLASH_DRAG_FACTOR * slashedShare;
  }

  return clamp(genuineness, GENUINENESS_FLOOR, GENUINENESS_CEILING);
}

/**
 * Sybil signal = dominance × burst_rate_normalized. Both must be high for the
 * penalty to fire — a single user with one query stays clean; an automated
 * agent firing 100 queries in 5 seconds collapses.
 */
function computeSybilSignal(observations: IntentObservation[]): number {
  if (observations.length === 0) return 0;

  // Dominance: largest single-actor share of observations.
  const counts = new Map<string, number>();
  for (const o of observations) counts.set(o.actor_id, (counts.get(o.actor_id) ?? 0) + 1);
  const maxActorCount = Math.max(...counts.values());
  const dominantActor = [...counts.entries()].find(([, n]) => n === maxActorCount)?.[0] ?? '';
  const dominance = maxActorCount / observations.length;

  // Burst rate: observations-per-second from the dominant actor within their
  // tightest contiguous window.
  const dominantObs = observations
    .filter((o) => o.actor_id === dominantActor)
    .map((o) => Date.parse(o.observed_at))
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);
  let burstRate = 0;
  if (dominantObs.length >= 2) {
    const spanSec = Math.max(1, (dominantObs[dominantObs.length - 1] - dominantObs[0]) / 1000);
    burstRate = dominantObs.length / spanSec;
  }
  const burstNorm = Math.min(1, burstRate / BURST_RATE_FLOOR_QPS);

  return dominance * burstNorm;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
