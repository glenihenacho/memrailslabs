import { calculateOrchestrationCost } from '@/lib/pricing/calculator';

export function packetCostCents(): number {
  return calculateOrchestrationCost(1) * 100;
}
