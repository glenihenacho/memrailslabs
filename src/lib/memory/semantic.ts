import type { EvidenceClaim } from '@/types/evidence';
import type { RetrievalResult } from '@/types/packet';
import type { CorpusEntry } from './corpus';
import { stemSet, computeIdf, weightedOverlap } from './lexical';

/**
 * L3 — Deterministic semantic fallback. Stemmed, IDF-weighted token overlap:
 * morphological variants match (`retrieve` ~ `retrieval`) and distinctive terms
 * outweigh filler. Real embeddings live behind this same interface for a later
 * phase (`§7 L3 acceptance`).
 */
export function semanticLayer(query: string, corpus: CorpusEntry[]): RetrievalResult {
  const start = Date.now();
  const qStems = stemSet(query);
  if (qStems.size === 0) {
    return {
      query,
      layer: 'L3_SEMANTIC',
      latency_ms: Date.now() - start,
      candidates: [],
      resolved: false,
      reason: 'no informative tokens after stopword removal',
    };
  }

  const docStems = corpus.map((e) => stemSet(`${e.claim.claim} ${e.body}`));
  const idf = computeIdf(docStems);
  const scored: Array<{ claim: EvidenceClaim; score: number }> = [];
  corpus.forEach((entry, i) => {
    const score = weightedOverlap(qStems, docStems[i], idf);
    if (score > 0) scored.push({ claim: entry.claim, score });
  });

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
