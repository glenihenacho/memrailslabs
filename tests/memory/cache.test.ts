import { beforeEach, describe, it, expect } from 'vitest';
import {
  retrievalSignature,
  observeRetrieval,
  recentCacheHitRate,
  adaptiveGrepThreshold,
  resetRetrievalCache,
  GREP_THRESHOLD_COLD,
  GREP_THRESHOLD_HOT,
} from '@/lib/memory/cache';

describe('retrieval cache + hit history', () => {
  beforeEach(resetRetrievalCache);

  it('treats a first sighting as a miss and a repeat as a hit', () => {
    const sig = retrievalSignature({ owner_id: 'o', project_id: 'p', task_context: 'same query' });
    expect(observeRetrieval(sig).cache_hit).toBe(false);
    expect(observeRetrieval(sig).cache_hit).toBe(true);
  });

  it('expires a warm signature past the TTL', () => {
    const sig = retrievalSignature({ owner_id: 'o', project_id: 'p', task_context: 'q' });
    const t0 = 1_000_000;
    expect(observeRetrieval(sig, t0).cache_hit).toBe(false);
    expect(observeRetrieval(sig, t0 + 6 * 60 * 1000).cache_hit).toBe(false); // > 5 min
  });

  it('reports a rolling hit rate', () => {
    const sig = retrievalSignature({ owner_id: 'o', project_id: 'p', task_context: 'q' });
    observeRetrieval(sig); // miss
    observeRetrieval(sig); // hit
    expect(recentCacheHitRate()).toBe(0.5);
  });
});

describe('adaptive grep threshold', () => {
  it('is strict when cold and trusting when hot', () => {
    expect(adaptiveGrepThreshold(0)).toBe(GREP_THRESHOLD_COLD);
    expect(adaptiveGrepThreshold(1)).toBe(GREP_THRESHOLD_HOT);
  });

  it('decreases monotonically with the hit rate', () => {
    expect(adaptiveGrepThreshold(0.25)).toBeGreaterThan(adaptiveGrepThreshold(0.75));
  });
});
