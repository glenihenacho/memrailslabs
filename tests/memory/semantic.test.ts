import { describe, it, expect } from 'vitest';
import { semanticLayer } from '@/lib/memory/semantic';
import { loadCorpus } from '@/lib/memory/corpus';

describe('L3 semantic', () => {
  const corpus = loadCorpus({ force: true });

  it('ranks candidates by token overlap', () => {
    const result = semanticLayer('retrieval order cheap filters', corpus);
    expect(result.candidates.length).toBeGreaterThan(0);
    // Either of the two retrieval-shaped claims is an acceptable top hit; both
    // dominate every other claim on this query.
    expect(['clm_retrieval_order', 'clm_architecture']).toContain(result.candidates[0].id);
  });

  it('marks resolved only when top score clears 0.4', () => {
    const strong = semanticLayer('evidence confidence floor filter', corpus);
    expect(strong.resolved).toBe(true);

    const weak = semanticLayer('completely unrelated zzznoise', corpus);
    expect(weak.resolved).toBe(false);
  });

  it('drops stopword-only queries before scoring', () => {
    const result = semanticLayer('the of and to', corpus);
    expect(result.candidates).toHaveLength(0);
    expect(result.resolved).toBe(false);
    expect(result.reason).toMatch(/no informative tokens/);
  });
});
