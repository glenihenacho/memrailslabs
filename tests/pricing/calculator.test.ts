import { describe, it, expect } from 'vitest';
import { calculateOrchestrationCost } from '@/lib/pricing/calculator';

describe('orchestration cost', () => {
  it('charges $5 per 10K packets', () => {
    expect(calculateOrchestrationCost(10_000)).toBe(5);
    expect(calculateOrchestrationCost(20_000)).toBe(10);
    expect(calculateOrchestrationCost(0)).toBe(0);
  });
});
