import { describe, expect, it } from 'vitest';
import { NotImplemented } from '@/lib/exchange/errors';
import { defaultPayout } from '@/lib/exchange/payout';
import type { AuctionResult } from '@/types/exchange';

const FAKE_RESULT: AuctionResult = {
  auction_id: 'a_stub',
  cluster_id: 'tic_stub',
  total_bids: 0,
  cleared_at: '2026-06-07T00:00:00.000Z',
};

describe('defaultPayout — Phase 5 stub', () => {
  it('settle() throws NotImplemented', () => {
    expect(() => defaultPayout.settle(FAKE_RESULT)).toThrow(NotImplemented);
  });

  it('ledger() throws NotImplemented', () => {
    expect(() => defaultPayout.ledger('p_x')).toThrow(NotImplemented);
  });

  it('NotImplemented carries the payout.* method name', () => {
    try {
      defaultPayout.settle(FAKE_RESULT);
    } catch (e) {
      expect((e as NotImplemented).method).toBe('payout.settle');
    }
  });
});
