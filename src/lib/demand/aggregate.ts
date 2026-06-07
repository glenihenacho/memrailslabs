import { existsSync, readFileSync } from 'node:fs';
import { contentHash, tokenize } from '@/lib/text/normalize';
import { intentsPath } from './observe';
import type { IntentCluster, IntentObservation } from '@/types/demand';

const JACCARD_THRESHOLD = 0.6;

export type LoadOptions = {
  since?: Date;
  until?: Date;
  /** When true (default), excludes observations from actors that opted out. */
  consenting_only?: boolean;
};

export function loadObservations(opts: LoadOptions = {}): IntentObservation[] {
  const path = intentsPath();
  if (!existsSync(path)) return [];
  const sinceMs = opts.since ? opts.since.getTime() : -Infinity;
  const untilMs = opts.until ? opts.until.getTime() : Infinity;
  const consentingOnly = opts.consenting_only ?? true;

  const out: IntentObservation[] = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    let obs: IntentObservation;
    try {
      obs = JSON.parse(trimmed) as IntentObservation;
    } catch {
      continue;
    }
    if (consentingOnly && obs.consent_share === false) continue;
    const t = Date.parse(obs.observed_at);
    if (Number.isNaN(t)) continue;
    if (t < sinceMs || t > untilMs) continue;
    out.push(obs);
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

type ProtoCluster = {
  observations: IntentObservation[];
  tokens: Set<string>;
};

function pickCanonical(observations: IntentObservation[]): string {
  // Highest-frequency raw_text variant; ties broken by lexical sort.
  const counts = new Map<string, number>();
  for (const o of observations) counts.set(o.raw_text, (counts.get(o.raw_text) ?? 0) + 1);
  let best = '';
  let bestCount = -1;
  const sorted = [...counts.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  for (const [text, n] of sorted) {
    if (n > bestCount) {
      best = text;
      bestCount = n;
    }
  }
  return best;
}

function buildCluster(observations: IntentObservation[]): IntentCluster {
  const canonical_text = pickCanonical(observations);
  const cluster_id = `tic_${contentHash(canonical_text)}`.slice(0, 16);
  const actor_ids = Array.from(new Set(observations.map((o) => o.actor_id))).sort();
  let authenticated = 0;
  let anonymous = 0;
  for (const id of actor_ids) {
    const sample = observations.find((o) => o.actor_id === id);
    if (sample?.identity_type === 'authenticated_account') authenticated += 1;
    else anonymous += 1;
  }
  const timestamps = observations.map((o) => o.observed_at).sort();
  return {
    cluster_id,
    canonical_text,
    observation_ids: observations.map((o) => o.intent_id),
    actor_ids,
    identity_mix: { authenticated, anonymous },
    first_observed: timestamps[0] ?? '',
    last_observed: timestamps[timestamps.length - 1] ?? '',
  };
}

export function clusterIntents(observations: IntentObservation[]): IntentCluster[] {
  if (observations.length === 0) return [];

  // Pass 1 — exact content_hash grouping (free; covers same-query repeats).
  const byHash = new Map<string, IntentObservation[]>();
  for (const o of observations) {
    const bucket = byHash.get(o.content_hash);
    if (bucket) bucket.push(o);
    else byHash.set(o.content_hash, [o]);
  }

  let protos: ProtoCluster[] = [];
  for (const bucket of byHash.values()) {
    const tokens = new Set<string>();
    for (const o of bucket) for (const t of tokenize(o.normalized_text)) tokens.add(t);
    protos.push({ observations: bucket, tokens });
  }

  // Pass 2 — collapse near-duplicate protos via token-set Jaccard ≥ 0.6.
  // Greedy single pass: each proto is compared against each accepted cluster
  // and merged into the first qualifying one.
  const merged: ProtoCluster[] = [];
  for (const p of protos) {
    let landed = false;
    for (const m of merged) {
      if (jaccard(p.tokens, m.tokens) >= JACCARD_THRESHOLD) {
        m.observations.push(...p.observations);
        for (const t of p.tokens) m.tokens.add(t);
        landed = true;
        break;
      }
    }
    if (!landed) merged.push(p);
  }

  return merged.map((m) => buildCluster(m.observations));
}
