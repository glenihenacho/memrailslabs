import { describe, it, expect } from 'vitest';
import { evidenceLayer, countContradictions } from '@/lib/memory/evidence';
import type { EvidenceClaim } from '@/types/evidence';

function claim(over: Partial<EvidenceClaim>): EvidenceClaim {
  return {
    id: 'clm_test',
    source_file: 'knowledge/claims/test.md',
    claim: 'a test claim',
    confidence: 0.9,
    tags: [],
    created_at: '2026-05-25',
    updated_at: '2026-05-25',
    ...over,
  };
}

describe('L4 evidence filter', () => {
  it('drops claims below the default 0.75 floor', () => {
    const candidates = [
      claim({ id: 'clm_high', confidence: 0.92 }),
      claim({ id: 'clm_low', confidence: 0.4 }),
    ];
    const result = evidenceLayer('q', candidates);
    expect(result.candidates.map((c) => c.id)).toEqual(['clm_high']);
    expect(result.resolved).toBe(true);
  });

  it('respects a custom floor', () => {
    const candidates = [claim({ confidence: 0.6 })];
    const high = evidenceLayer('q', candidates, 0.75);
    const low = evidenceLayer('q', candidates, 0.5);
    expect(high.resolved).toBe(false);
    expect(low.resolved).toBe(true);
  });

  it('returns no candidates when everything is below the floor', () => {
    const result = evidenceLayer('q', [claim({ confidence: 0.2 })]);
    expect(result.candidates).toHaveLength(0);
    expect(result.resolved).toBe(false);
    expect(result.reason).toMatch(/below confidence floor/);
  });

  it('counts unique contradictions across candidates', () => {
    const candidates = [
      claim({ id: 'clm_a', contradictions: ['clm_x', 'clm_y'] }),
      claim({ id: 'clm_b', contradictions: ['clm_y', 'clm_z'] }),
      claim({ id: 'clm_c' }),
    ];
    expect(countContradictions(candidates)).toBe(3);
  });
});
