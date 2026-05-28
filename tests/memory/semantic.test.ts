import { describe, it, expect } from 'vitest';
import { semanticLayer } from '@/lib/memory/semantic';
import { loadCorpus } from '@/lib/memory/corpus';

describe('L3 semantic', () => {
  const corpus = loadCorpus({ force: true });

  it('ranks claims by token overlap and surfaces relevant ones', () => {
    const result = semanticLayer('evidence confidence floor filter', corpus);
    expect(result.candidates.length).toBeGreaterThan(0);
    // The evidence-floor claim shares the most tokens, so it must appear.
    expect(result.candidates.some((c) => c.id === 'clm_evidence_floor')).toBe(true);
  });

  it('returns unresolved when the query is only stopwords', () => {
    const result = semanticLayer('what is the and to of', corpus);
    expect(result.resolved).toBe(false);
    expect(result.candidates).toHaveLength(0);
  });

  it('caps the candidate set at the top 5', () => {
    const result = semanticLayer('memory packet retrieval evidence pricing', corpus);
    expect(result.candidates.length).toBeLessThanOrEqual(5);
  });
});
