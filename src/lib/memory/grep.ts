import type { EvidenceClaim } from '@/types/evidence';
import type { RetrievalResult } from '@/types/packet';
import type { CorpusEntry } from './corpus';

/**
 * L1 — Literal substring retrieval across the markdown corpus.
 * Cheapest possible filter: no model, no embedding, no tokenizer.
 */
export function grepLayer(query: string, corpus: CorpusEntry[]): RetrievalResult {
  const start = Date.now();
  const needle = query.trim().toLowerCase();
  const candidates: EvidenceClaim[] = [];

  if (needle.length === 0) {
    return {
      query,
      layer: 'L1_GREP',
      latency_ms: Date.now() - start,
      candidates: [],
      resolved: false,
      reason: 'empty query',
    };
  }

  for (const entry of corpus) {
    const haystack = `${entry.claim.claim}\n${entry.body}`.toLowerCase();
    if (haystack.includes(needle)) {
      candidates.push(entry.claim);
    }
  }

  return {
    query,
    layer: 'L1_GREP',
    latency_ms: Date.now() - start,
    candidates,
    resolved: candidates.length > 0,
    reason:
      candidates.length > 0
        ? `literal match in ${candidates.length} file(s)`
        : 'no literal substring match',
  };
}
