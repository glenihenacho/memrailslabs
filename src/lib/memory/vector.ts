import { createHash } from 'node:crypto';
import type { MemoryRecord } from '@/types/governed';
import { tokenize } from './ranking';

/**
 * Vector fallback (C5.3) — hybrid mode's safety net, never the primary path.
 *
 * The non-goal stands: no `conversation → chunk → embed → top_k → prompt`.
 * This fires only in `hybrid` mode when tree reasoning has a weak signal
 * (top branch overlap below threshold), and every firing is recorded in the
 * retrieval trace (`policy_filters_applied` gains `vector_fallback`).
 *
 * The embedding is deterministic and local: hashed bag-of-words into a
 * 256-dim L2-normalized vector, cosine similarity. It needs no model, no
 * network, and no index for corpus-scale N. pgvector slots in behind this
 * same interface when a pg-wire Postgres is present (PGlite 0.5.x does not
 * bundle the vector extension): same embed(), `<->` instead of cosine().
 */

const DIM = 256;

export function embed(text: string): Float64Array {
  const v = new Float64Array(DIM);
  for (const token of tokenize(text)) {
    const h = createHash('sha1').update(token).digest();
    const idx = h.readUInt16BE(0) % DIM;
    const sign = h[2] % 2 === 0 ? 1 : -1;
    v[idx] += sign;
  }
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < DIM; i += 1) v[i] /= norm;
  return v;
}

export function cosine(a: Float64Array, b: Float64Array): number {
  let dot = 0;
  for (let i = 0; i < DIM; i += 1) dot += a[i] * b[i];
  return dot;
}

/** Nearest in-scope memories to the task context, by embedding similarity. */
export function vectorFallback(
  taskContext: string,
  candidates: MemoryRecord[],
  limit = 5,
): Array<{ memory_id: string; similarity: number }> {
  const q = embed(taskContext);
  return candidates
    .map((r) => ({
      memory_id: r.memory_id,
      similarity: Number(cosine(q, embed(`${r.summary} ${r.content} ${r.tags.join(' ')}`)).toFixed(4)),
    }))
    .filter((s) => s.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}
