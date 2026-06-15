/**
 * Retrieval cache + hit-history — the adaptive control loop for the grep
 * short-circuit.
 *
 * Each retrieval has a signature (scope + normalized task context). A signature
 * seen again within the warm window is a **cache hit**. We keep a rolling
 * window of recent hit/miss outcomes; its rate tunes how aggressively the
 * rigorous-grep stage is allowed to resolve and skip the L3 semantic blend:
 *
 *   - hits frequent  → corpus/queries are stable → trust grep → lower the bar.
 *   - misses dominate → novel queries → fall through to semantic → raise the bar.
 *
 * All state is in-process (the MVP stand-in for Redis); `resetRetrievalCache`
 * exists so tests are deterministic.
 */

import { shortHash } from '@/lib/observability/hash';
import { HotRail } from '@/lib/rails/hot';

/** Grep coverage required to skip semantic, as a function of the hit rate. */
export const GREP_THRESHOLD_COLD = 0.9; // novel traffic: strict, rarely skip
export const GREP_THRESHOLD_HOT = 0.6; // warm traffic: trust grep, skip more

const WARM_TTL_MS = 5 * 60 * 1000; // a signature stays "warm" for 5 minutes
const HISTORY_SIZE = 20; // rolling window of recent outcomes

const warmSignatures = new HotRail<number>(1024); // signature → last-seen epoch ms
let history: boolean[] = []; // true = cache hit, newest last

/** Stable signature for a retrieval: scope + normalized task context. */
export function retrievalSignature(parts: {
  owner_id: string;
  project_id: string;
  agent_id?: string | null;
  task_context: string;
}): string {
  const norm = parts.task_context.trim().toLowerCase().replace(/\s+/g, ' ');
  return shortHash(`${parts.owner_id}|${parts.project_id}|${parts.agent_id ?? ''}|${norm}`, 16);
}

/**
 * Record a retrieval by signature and report whether it was a cache hit (the
 * signature was already warm). Updates the warm marker and the rolling history.
 */
export function observeRetrieval(signature: string, now = Date.now()): { cache_hit: boolean } {
  const lastSeen = warmSignatures.get(signature);
  const cache_hit = lastSeen !== undefined && now - lastSeen <= WARM_TTL_MS;

  warmSignatures.set(signature, now);
  history.push(cache_hit);
  if (history.length > HISTORY_SIZE) history = history.slice(-HISTORY_SIZE);

  return { cache_hit };
}

/** Recent cache-hit rate in [0, 1] over the rolling window (0 when empty). */
export function recentCacheHitRate(): number {
  if (history.length === 0) return 0;
  const hits = history.reduce((n, h) => n + (h ? 1 : 0), 0);
  return Number((hits / history.length).toFixed(4));
}

/**
 * Adaptive grep-resolve threshold. Interpolates from the cold (strict) bar to
 * the hot (trusting) bar by the current cache-hit rate.
 */
export function adaptiveGrepThreshold(hitRate = recentCacheHitRate()): number {
  const clamped = Math.min(1, Math.max(0, hitRate));
  const t = GREP_THRESHOLD_COLD - (GREP_THRESHOLD_COLD - GREP_THRESHOLD_HOT) * clamped;
  return Number(t.toFixed(4));
}

/** Test/maintenance hook — clears warm signatures and history. */
export function resetRetrievalCache(): void {
  warmSignatures.clear();
  history = [];
}
