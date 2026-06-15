import { PRICE_PER_RETRIEVAL_USD } from '@/types/billing';

/**
 * Retrieval pricing — the commercial primitive. One successful
 * `memory.retrieve()` = one billable retrieval at $0.002 ($2 / 1,000).
 * No seat fees, no arbitrary quotas; usage-based pricing absorbs scale.
 */
export function calculateRetrievalCost(retrievalCount: number): number {
  return Number((retrievalCount * PRICE_PER_RETRIEVAL_USD).toFixed(4));
}

/**
 * Legacy orchestration pricing — $5 per 10,000 packets (CLAUDE.md §11).
 * Retained for the packet path; the product meters by retrieval (above).
 */
export function calculateOrchestrationCost(packetCount: number): number {
  return (packetCount / 10_000) * 5;
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
