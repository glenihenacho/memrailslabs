import { PRICE_PER_RETRIEVAL_USD } from '@/types/billing';

/**
 * The single MemRails fee — the orchestration/retrieval unit, separate from
 * model inference. One non-cache-hit `memory.retrieve()` = one billable unit at
 * $0.00062 ($0.62 / 1,000), regardless of which layer resolved it. No seat
 * fees, no arbitrary quotas, no separate packet/synthesis fee; usage-based
 * pricing absorbs scale.
 */
export function calculateRetrievalCost(retrievalCount: number): number {
  return Number((retrievalCount * PRICE_PER_RETRIEVAL_USD).toFixed(6));
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
