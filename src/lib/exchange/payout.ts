import type { AuctionResult, PayoutLedger } from '@/types/exchange';
import { NotImplemented } from './errors';

/**
 * The payout engine the foundation reserves but does not implement.
 *
 * When the real engine lands it will:
 *  - emit ATTRIBUTION_PAID on `settle()` (event type already declared in
 *    src/types/ledger.ts)
 *  - read intent provenance back through the JSONL lake and stake records
 *    in data/demand/stakes/ to construct AttributionShare[]
 *  - persist the PayoutLedger as file-per-payout under
 *    data/exchange/payouts/, mirroring src/lib/payments/store.ts patterns
 */
export interface PayoutEngine {
  settle(result: AuctionResult): PayoutLedger;
  ledger(payout_id: string): PayoutLedger | null;
}

export const defaultPayout: PayoutEngine = {
  settle(_result: AuctionResult): PayoutLedger {
    throw new NotImplemented('payout.settle');
  },
  ledger(_payout_id: string): PayoutLedger | null {
    throw new NotImplemented('payout.ledger');
  },
};
