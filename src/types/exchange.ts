// Phase 5 stub types. These shapes are intentionally minimal — the real
// auction model isn't decided yet; locking richer fields in now would
// constrain that decision. The fields below are the ones every plausible
// auction shape will carry (id, cluster reference, status, attribution
// targets); anything more is up to the implementation phase.

export type AuctionStatus = 'open' | 'cleared' | 'cancelled';

export type AuctionBid = {
  bid_id: string;
  auction_id: string;
  actor_id: string;
  price_cents: number;
  submitted_at: string;
};

export type Auction = {
  auction_id: string;
  cluster_id: string;
  status: AuctionStatus;
  opened_at: string;
  cleared_at?: string;
  bids: AuctionBid[];
  winning_bid_id?: string;
};

export type AuctionResult = {
  auction_id: string;
  cluster_id: string;
  winning_bid?: AuctionBid;
  total_bids: number;
  cleared_at: string;
};

export type AttributionReason = 'contributor' | 'staker' | 'platform';

export type AttributionShare = {
  actor_id: string;
  amount_cents: number;
  reason: AttributionReason;
};

export type PayoutLedger = {
  payout_id: string;
  auction_id: string;
  beneficiaries: AttributionShare[];
  total_cents: number;
  settled_at: string;
};
