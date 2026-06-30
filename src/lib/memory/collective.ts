/**
 * The collective — cross-tenant predictive insights, by opt-in only.
 *
 * A global plane (like authority/telemetry/analytics): it aggregates across
 * tenants who have **consented** (`collective_opt_in`). Privacy is structural,
 * not bolted on:
 *
 *  - **Opt-in & reciprocal** — only consenting tenants contribute, and only
 *    consenting tenants receive insights. Default off.
 *  - **Aggregate-only** — insights are derived from tags/topics + counts. No
 *    tenant ever sees another tenant's note bodies, ids, or scope.
 *  - **k-anonymous** — a signal is only surfaced when it is backed by at least
 *    `minSupport` *distinct other* tenants, so no single tenant leaks through
 *    an "aggregate."
 *  - **Deterministic & grounded** — link prediction from real co-occurrence,
 *    never generation.
 */

import { loadRegistry } from './registry';
import { optedInOwners } from '@/lib/accounts/store';

const MIN_SUPPORT_DEFAULT = 3;

export type CollectiveInsight = {
  /** A topic the caller already has. */
  from_topic: string;
  /** A topic predicted relevant — commonly co-occurs with `from_topic`. */
  predicted_topic: string;
  /** Number of distinct OTHER opted-in tenants backing this signal. */
  support: number;
  basis: 'co-occurrence';
};

/** Topics for each opted-in owner — tags only, lowercased, unioned. */
function topicsByOptedInOwner(): Map<string, Set<string>> {
  const opted = new Set(optedInOwners());
  const map = new Map<string, Set<string>>();
  if (opted.size === 0) return map;
  for (const r of loadRegistry()) {
    if (!opted.has(r.scope.owner_id)) continue;
    const set = map.get(r.scope.owner_id) ?? new Set<string>();
    for (const tag of r.tags) set.add(tag.toLowerCase());
    map.set(r.scope.owner_id, set);
  }
  return map;
}

/** Coarse, public-safe size of the consenting collective. */
export function collectiveSize(): number {
  return optedInOwners().length;
}

/**
 * Predict topics relevant to the caller from cross-tenant co-occurrence.
 * Returns [] if the caller hasn't opted in (enforced again at the route).
 */
export function predictiveInsights(
  owner_id: string,
  opts: { minSupport?: number } = {},
): CollectiveInsight[] {
  const minSupport = Math.max(2, opts.minSupport ?? MIN_SUPPORT_DEFAULT);
  const topicsByOwner = topicsByOptedInOwner();
  const callerTopics = topicsByOwner.get(owner_id);
  if (!callerTopics) return []; // not opted in, or no tagged memory

  // Topic-pair → set of OTHER owners exhibiting both (k-anonymity basis).
  const pairOwners = new Map<string, Set<string>>();
  for (const [oid, topics] of topicsByOwner) {
    if (oid === owner_id) continue;
    const arr = [...topics];
    for (let i = 0; i < arr.length; i += 1) {
      for (let j = i + 1; j < arr.length; j += 1) {
        const [a, b] = arr[i] < arr[j] ? [arr[i], arr[j]] : [arr[j], arr[i]];
        const key = `${a}|${b}`;
        const set = pairOwners.get(key) ?? new Set<string>();
        set.add(oid);
        pairOwners.set(key, set);
      }
    }
  }

  const insights: CollectiveInsight[] = [];
  for (const [key, owners] of pairOwners) {
    if (owners.size < minSupport) continue; // k-anonymity gate
    const [a, b] = key.split('|');
    // The caller has one side of a widely-seen pair but not the other → predict it.
    if (callerTopics.has(a) && !callerTopics.has(b)) {
      insights.push({ from_topic: a, predicted_topic: b, support: owners.size, basis: 'co-occurrence' });
    } else if (callerTopics.has(b) && !callerTopics.has(a)) {
      insights.push({ from_topic: b, predicted_topic: a, support: owners.size, basis: 'co-occurrence' });
    }
  }

  insights.sort((x, y) => y.support - x.support || x.predicted_topic.localeCompare(y.predicted_topic));
  return insights.slice(0, 25);
}
