export type LedgerEventType =
  | 'QUERY'
  | 'PACKET_CREATED'
  | 'MCP_TOOL_CALL'
  | 'REFACTOR_PROPOSED'
  | 'REFACTOR_ACCEPTED'
  | 'PAYMENT_AUTHORIZED'
  | 'PACKET_BILLED';

export type LedgerEvent = {
  event_id: string;
  event_type: LedgerEventType;
  actor_id?: string;
  session_id?: string;
  packet_id?: string;
  input_hash?: string;
  output_hash?: string;
  cost_cents?: number;
  metadata: Record<string, unknown>;
  created_at: string;
};
