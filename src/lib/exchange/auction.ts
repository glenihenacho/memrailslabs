import type { Auction, AuctionResult } from '@/types/exchange';
import { NotImplemented } from './errors';

/**
 * The auction engine the foundation reserves but does not implement.
 *
 * When the real engine lands it will:
 *  - emit AUCTION_OPENED on `open()` (event type already declared in
 *    src/types/ledger.ts)
 *  - persist bids — likely as file-per-bid under data/exchange/auctions/
 *    matching the pattern in src/lib/payments/store.ts
 *  - emit AUCTION_CLEARED on `clear()` with the AuctionResult shape
 *    declared in src/types/exchange.ts
 *  - wire the existing PAYMENT_AUTHORIZED / PACKET_BILLED events into
 *    settlement (no schema change to those events)
 */
export interface AuctionEngine {
  open(cluster_id: string): Auction;
  submitBid(auction_id: string, actor_id: string, price_cents: number): void;
  clear(auction_id: string): AuctionResult;
  get(auction_id: string): Auction | null;
}

export const defaultAuction: AuctionEngine = {
  open(_cluster_id: string): Auction {
    throw new NotImplemented('auction.open');
  },
  submitBid(_auction_id: string, _actor_id: string, _price_cents: number): void {
    throw new NotImplemented('auction.submitBid');
  },
  clear(_auction_id: string): AuctionResult {
    throw new NotImplemented('auction.clear');
  },
  get(_auction_id: string): Auction | null {
    throw new NotImplemented('auction.get');
  },
};
