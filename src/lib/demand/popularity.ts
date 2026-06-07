import type {
  IntentCluster,
  IntentObservation,
  PopularityScore,
  Window,
} from '@/types/demand';

const AUTHENTICATED_WEIGHT = 1.0;
const ANONYMOUS_WEIGHT = 0.4;
const VELOCITY_FLOOR = 0.1;
const DEFAULT_GENUINENESS = 1.0;

export type ScoreOptions = {
  window: Window;
  /** Override the genuineness score. Phase 4 wires this from the genuineness layer. */
  genuineness?: number;
};

export function score(
  cluster: IntentCluster,
  observations: IntentObservation[],
  opts: ScoreOptions,
): PopularityScore {
  const sinceMs = Date.parse(opts.window.since);
  const untilMs = Date.parse(opts.window.until);
  const durationSec = Math.max(1, (untilMs - sinceMs) / 1000);

  const inWindow = observations.filter((o) => cluster.observation_ids.includes(o.intent_id));
  const observationCount = inWindow.length;
  const frequency = observationCount / durationSec;

  // Velocity: second-half vs first-half count. Normalized to a bounded
  // multiplier so it can scale composite without dominating it.
  const midMs = (sinceMs + untilMs) / 2;
  const firstHalf = inWindow.filter((o) => Date.parse(o.observed_at) < midMs).length;
  const secondHalf = observationCount - firstHalf;
  const velocity = secondHalf - firstHalf;
  const velocityScaled = Math.max(1 + velocity / Math.max(1, observationCount), VELOCITY_FLOOR);

  // Breadth: distinct actor_ids, weighted by identity_type.
  const breadth =
    cluster.identity_mix.authenticated * AUTHENTICATED_WEIGHT +
    cluster.identity_mix.anonymous * ANONYMOUS_WEIGHT;

  const genuineness = opts.genuineness ?? DEFAULT_GENUINENESS;
  const composite = frequency * velocityScaled * breadth * genuineness;

  return {
    cluster_id: cluster.cluster_id,
    canonical_text: cluster.canonical_text,
    observations: observationCount,
    frequency,
    velocity,
    breadth,
    genuineness,
    composite,
    actor_ids: cluster.actor_ids,
    window: opts.window,
  };
}

export function rank(scores: PopularityScore[]): PopularityScore[] {
  return [...scores].sort((a, b) => b.composite - a.composite);
}
