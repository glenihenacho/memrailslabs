import type { EvidenceClaim } from '@/types/evidence';
import type { RetrievalResult } from '@/types/packet';
import type { CorpusEntry } from './corpus';

/**
 * L2 — Structured lookup by frontmatter id, alias, or tag.
 */
export function keyLayer(query: string, corpus: CorpusEntry[]): RetrievalResult {
  const start = Date.now();
  const normalized = query.trim().toLowerCase();
  const candidates: EvidenceClaim[] = [];

  for (const entry of corpus) {
    const aliases = (entry.claim.aliases ?? []).map((a) => a.toLowerCase());
    const tags = entry.claim.tags.map((t) => t.toLowerCase());
    const id = entry.claim.id.toLowerCase();

    const hit =
      id === normalized ||
      aliases.some((a) => a === normalized || normalized.includes(a)) ||
      tags.some((t) => normalized.includes(t) || normalized === t);

    if (hit) {
      candidates.push(entry.claim);
    }
  }

  return {
    query,
    layer: 'L2_KEY',
    latency_ms: Date.now() - start,
    candidates,
    resolved: candidates.length > 0,
    reason:
      candidates.length > 0
        ? `key/alias/tag match in ${candidates.length} file(s)`
        : 'no key match',
  };
}
