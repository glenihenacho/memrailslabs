import { describe, expect, it } from 'vitest';
import { NotImplemented } from '@/lib/exchange/errors';
import { defaultAuction } from '@/lib/exchange/auction';

describe('defaultAuction — Phase 5 stub', () => {
  it('open() throws NotImplemented with the auction.open identifier', () => {
    expect(() => defaultAuction.open('tic_x')).toThrow(NotImplemented);
    try {
      defaultAuction.open('tic_x');
    } catch (e) {
      expect((e as NotImplemented).method).toBe('auction.open');
    }
  });

  it('submitBid() throws NotImplemented', () => {
    expect(() => defaultAuction.submitBid('a_1', 'actor', 100)).toThrow(NotImplemented);
  });

  it('clear() throws NotImplemented', () => {
    expect(() => defaultAuction.clear('a_1')).toThrow(NotImplemented);
  });

  it('get() throws NotImplemented', () => {
    expect(() => defaultAuction.get('a_1')).toThrow(NotImplemented);
  });

  it('NotImplemented message names the calling phase', () => {
    try {
      defaultAuction.open('tic_x');
    } catch (e) {
      expect((e as Error).message).toContain('exchange_not_implemented');
      expect((e as Error).message).toContain('auction.open');
    }
  });
});
