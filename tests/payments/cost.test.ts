import { describe, it, expect } from 'vitest';
import { packetCostCents } from '@/lib/payments/cost';
import { calculateOrchestrationCost, formatUsd } from '@/lib/pricing/calculator';

describe('packet cost', () => {
  it('derives a per-packet cost of 0.05 cents from the $5/10K rate', () => {
    expect(packetCostCents()).toBeCloseTo(0.05, 10);
    expect(packetCostCents()).toBe(calculateOrchestrationCost(1) * 100);
  });

  it('aggregates back to $5 across 10K packets', () => {
    const total = packetCostCents() * 10_000;
    expect(total).toBeCloseTo(500, 10);
    expect(formatUsd(total / 100)).toBe('$5.00');
  });
});

describe('formatUsd', () => {
  it('renders sub-cent values rounded to two decimals', () => {
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUsd(0.0005)).toBe('$0.00');
    expect(formatUsd(0.5)).toBe('$0.50');
    expect(formatUsd(1.234)).toBe('$1.23');
    expect(formatUsd(1.235)).toBe('$1.24');
  });
});
