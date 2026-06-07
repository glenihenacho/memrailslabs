import { describe, expect, it } from 'vitest';
import { LEDGER_EVENT_TYPES } from '@/types/ledger';

describe('LedgerEventType declarations', () => {
  it('declares the Phase 5 exchange-stub event types', () => {
    expect(LEDGER_EVENT_TYPES).toContain('AUCTION_OPENED');
    expect(LEDGER_EVENT_TYPES).toContain('AUCTION_CLEARED');
    expect(LEDGER_EVENT_TYPES).toContain('ATTRIBUTION_PAID');
  });

  it('preserves the Phase 1–4 demand events', () => {
    for (const t of [
      'INTENT_OBSERVED',
      'INTENT_FULFILLED',
      'INTENT_STAKE_POSTED',
      'INTENT_STAKE_SLASHED',
    ]) {
      expect(LEDGER_EVENT_TYPES).toContain(t);
    }
  });

  it('preserves the substrate events (refactor / payment / harness / MCP)', () => {
    for (const t of [
      'QUERY',
      'PACKET_CREATED',
      'MCP_TOOL_CALL',
      'REFACTOR_PROPOSED',
      'REFACTOR_ACCEPTED',
      'REFACTOR_REJECTED',
      'PAYMENT_AUTHORIZED',
      'PACKET_BILLED',
      'HARNESS_DEPLOYED',
    ]) {
      expect(LEDGER_EVENT_TYPES).toContain(t);
    }
  });

  it('has no duplicate event types', () => {
    expect(new Set(LEDGER_EVENT_TYPES).size).toBe(LEDGER_EVENT_TYPES.length);
  });
});
