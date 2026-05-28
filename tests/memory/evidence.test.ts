import { describe, it, expect } from 'vitest';
import { evidenceLayer, countContradictions } from '@/lib/memory/evidence';
import type { EvidenceClaim } from '@/types/evidence';

function claim(id: string, confidence: number, contradictions?: string[]): EvidenceClaim {
  return {
    id,
    source_file: `knowledge/${id}.md`,
    claim: `claim ${id}`,
    confidence,
    tags: [],
    contradictions,
    created_at: '2026-05-25',
    updated_at: '2026-05-25',
  };
}

describe('L4 evidence filter', () => {
  it('drops candidates below the default 0.75 floor', () => {
    const result = evidenceLayer('q', [claim('a', 0.9), claim('b', 0.5)]);
    expect(result.candidates.map((c) => c.id)).toEqual(['a']);
    expect(result.resolved).toBe(true);
  });

  it('respects a custom floor', () => {
    const result = evidenceLayer('q', [claim('a', 0.8)], 0.85);
    expect(result.candidates).toHaveLength(0);
    expect(result.resolved).toBe(false);
  });

  it('surfaces de-duplicated contradiction count in the reason', () => {
    const result = evidenceLayer('q', [
      claim('a', 0.9, ['x', 'y']),
      claim('b', 0.9, ['x']),
    ]);
    expect(result.reason).toContain('2 contradiction(s) surfaced');
  });
});

describe('countContradictions', () => {
  it('de-duplicates across claims', () => {
    expect(
      countContradictions([claim('a', 0.9, ['x', 'y']), claim('b', 0.9, ['x', 'z'])]),
    ).toBe(3);
  });
});
