export type LedgerEventType =
  | 'QUERY'
  | 'PACKET_CREATED'
  | 'MCP_TOOL_CALL'
  | 'REFACTOR_PROPOSED'
  | 'REFACTOR_ACCEPTED'
  | 'REFACTOR_REJECTED'
  | 'PAYMENT_AUTHORIZED'
  | 'PACKET_BILLED'
  | 'HARNESS_DEPLOYED'
  | 'INTENT_OBSERVED'
  | 'INTENT_FULFILLED'
  | 'INTENT_STAKE_POSTED'
  | 'INTENT_STAKE_SLASHED'
  | 'AUCTION_OPENED'
  | 'AUCTION_CLEARED'
  | 'ATTRIBUTION_PAID';

// Runtime list mirroring the type union — used by the exchange-event
// declaration test and by any future consumer that needs to iterate
// known event types (e.g., a Console event-type filter).
export const LEDGER_EVENT_TYPES: readonly LedgerEventType[] = [
  'QUERY',
  'PACKET_CREATED',
  'MCP_TOOL_CALL',
  'REFACTOR_PROPOSED',
  'REFACTOR_ACCEPTED',
  'REFACTOR_REJECTED',
  'PAYMENT_AUTHORIZED',
  'PACKET_BILLED',
  'HARNESS_DEPLOYED',
  'INTENT_OBSERVED',
  'INTENT_FULFILLED',
  'INTENT_STAKE_POSTED',
  'INTENT_STAKE_SLASHED',
  'AUCTION_OPENED',
  'AUCTION_CLEARED',
  'ATTRIBUTION_PAID',
] as const;

export type LedgerEvent = {
  event_id: string;
  event_type: LedgerEventType;
  actor_id?: string;
  session_id?: string;
  endpoint_id?: string;
  packet_id?: string;
  input_hash?: string;
  output_hash?: string;
  cost_cents?: number;
  metadata: Record<string, unknown>;
  created_at: string;
};
