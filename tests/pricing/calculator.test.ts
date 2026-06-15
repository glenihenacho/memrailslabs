import { describe, it, expect } from 'vitest';
import { calculateRetrievalCost } from '@/lib/pricing/calculator';

describe('retrieval fee — the single MemRails fee', () => {
  it('charges $0.00062 per billable retrieval ($0.62 / 1,000)', () => {
    expect(calculateRetrievalCost(1)).toBe(0.00062);
    expect(calculateRetrievalCost(1000)).toBe(0.62);
    expect(calculateRetrievalCost(10_000)).toBe(6.2);
    expect(calculateRetrievalCost(0)).toBe(0);
  });
});
