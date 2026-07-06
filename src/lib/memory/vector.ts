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
 * The embedding is deterministic and local: FNV-1a-hashed bag-of-words into
 * a 256-dim L2-normalized vector, cosine similarity. (FNV-1a, not a crypto
 * hash — this is feature bucketing on a hot path, not security.) Record
 * embeddings are memoized by memory_id + updated_at so unchanged content is
 * never re-hashed across retrievals. pgvector slots in behind this same
 * interface when a pg-wire Postgres is present (PGlite 0.5.x does not
 * bundle the vector extension): same embed(), `<->` instead of cosine().
 */

const DIM = 256;

/** Deterministic 32-bit FNV-1a — feature hashing, no crypto overhead. */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function embed(text: string): Float64Array {
  const v = new Float64Array(DIM);
  for (const token of tokenize(text)) {
    const h = fnv1a(token);
    const idx = h % DIM;
    const sign = (h >>> 16) % 2 === 0 ? 1 : -1;
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

// Memoized record embeddings, keyed by memory_id + updated_at — a changed
// record gets a new key, so no explicit invalidation hook is needed.
const embeddingCache = new Map<string, Float64Array>();
const CACHE_CAP = 4096;

function recordEmbedding(r: MemoryRecord): Float64Array {
  const key = `${r.memory_id}|${r.updated_at}`;
  const cached = embeddingCache.get(key);
  if (cached) return cached;
  const v = embed(`${r.summary} ${r.content} ${r.tags.join(' ')}`);
  if (embeddingCache.size >= CACHE_CAP) embeddingCache.clear(); // simple bound
  embeddingCache.set(key, v);
  return v;
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
      similarity: Number(cosine(q, recordEmbedding(r)).toFixed(4)),
    }))
    .filter((s) => s.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}
