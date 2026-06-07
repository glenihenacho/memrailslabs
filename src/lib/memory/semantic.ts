import type { EvidenceClaim } from '@/types/evidence';
import type { RetrievalResult } from '@/types/packet';
import type { CorpusEntry } from './corpus';
import { tokenize } from '@/lib/text/normalize';

/**
 * L3 — Deterministic token-overlap fallback. Real embeddings live behind this
 * interface but are deferred to a later phase (`§7 L3 acceptance`).
 */
export function semanticLayer(query: string, corpus: CorpusEntry[]): RetrievalResult {
  const start = Date.now();
  const qTokens = new Set(tokenize(query));
  if (qTokens.size === 0) {
    return {
      query,
      layer: 'L3_SEMANTIC',
      latency_ms: Date.now() - start,
      candidates: [],
      resolved: false,
      reason: 'no informative tokens after stopword removal',
    };
  }

  const scored: Array<{ claim: EvidenceClaim; score: number }> = [];
  for (const entry of corpus) {
    const dTokens = new Set(tokenize(`${entry.claim.claim} ${entry.body}`));
    let overlap = 0;
    for (const t of qTokens) if (dTokens.has(t)) overlap += 1;
    const score = overlap / qTokens.size;
    if (score > 0) scored.push({ claim: entry.claim, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 5).map((s) => s.claim);

  return {
    query,
    layer: 'L3_SEMANTIC',
    latency_ms: Date.now() - start,
    candidates: top,
    resolved: top.length > 0 && (scored[0]?.score ?? 0) >= 0.4,
    reason:
      top.length > 0
        ? `token-overlap score ${scored[0].score.toFixed(2)} (top of ${scored.length})`
        : 'no token overlap',
  };
}
