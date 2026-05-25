import type { EvidenceClaim } from '@/types/evidence';
import type { RetrievalResult } from '@/types/packet';

const DEFAULT_FLOOR = 0.75;

/**
 * L4 — Quality gate. Filters candidates by confidence, surfaces
 * contradictions instead of hiding them (`§7 L4 acceptance`).
 */
export function evidenceLayer(
  query: string,
  candidates: EvidenceClaim[],
  floor: number = DEFAULT_FLOOR,
): RetrievalResult {
  const start = Date.now();
  const filtered = candidates.filter((c) => c.confidence >= floor);
  const contradictions = candidates
    .flatMap((c) => c.contradictions ?? [])
    .filter((id, idx, arr) => arr.indexOf(id) === idx);

  return {
    query,
    layer: 'L4_EVIDENCE',
    latency_ms: Date.now() - start,
    candidates: filtered,
    resolved: filtered.length > 0,
    reason:
      filtered.length > 0
        ? `${filtered.length}/${candidates.length} above confidence floor ${floor}; ${contradictions.length} contradiction(s) surfaced`
        : `all ${candidates.length} candidates below confidence floor ${floor}`,
  };
}

export function countContradictions(candidates: EvidenceClaim[]): number {
  const seen = new Set<string>();
  for (const c of candidates) {
    for (const id of c.contradictions ?? []) seen.add(id);
  }
  return seen.size;
}
