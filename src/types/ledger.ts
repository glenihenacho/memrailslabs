export type LedgerEventType =
  | 'QUERY'
  | 'PACKET_CREATED'
  | 'MCP_TOOL_CALL'
  | 'REFACTOR_PROPOSED'
  | 'REFACTOR_ACCEPTED'
  | 'PAYMENT_AUTHORIZED'
  | 'PACKET_BILLED'
  // Governed memory lifecycle (memory.retrieve architecture)
  | 'MEMORY_RETRIEVED'
  | 'MEMORY_WRITTEN'
  | 'MEMORY_SUPERSEDED'
  | 'MEMORY_DISPUTED'
  | 'MEMORY_DELETED'
  | 'FEEDBACK_RECORDED'
  | 'RETRIEVAL_BILLED'
  // Portability (contract v0.1 §6)
  | 'MEMORY_EXPORTED'
  | 'MEMORY_IMPORTED'
  // Ledger as event spine (conversion phase C3)
  | 'MEMORY_RESTORED'
  | 'MEMORY_CONFIDENCE_UPDATED'
  | 'MEMORY_GOVERNANCE_IMPORTED';

export type LedgerEvent = {
  event_id: string;
  event_type: LedgerEventType;
  /** Catalog schema version of this event's payload (C3; absent = pre-catalog v0). */
  schema_version?: number;
  actor_id?: string;
  session_id?: string;
  packet_id?: string;
  memory_id?: string;
  retrieval_id?: string;
  owner_id?: string;
  project_id?: string;
  agent_id?: string;
  input_hash?: string;
  output_hash?: string;
  cost_cents?: number;
  metadata: Record<string, unknown>;
  created_at: string;
};
