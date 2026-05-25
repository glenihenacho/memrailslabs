/**
 * Orchestration pricing — $5 per 10,000 packets (CLAUDE.md §11).
 * Seat fees are explicitly excluded.
 */
export function calculateOrchestrationCost(packetCount: number): number {
  return (packetCount / 10_000) * 5;
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
