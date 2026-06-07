export type DemandSource = 'memory_query' | 'mcp_tool_call' | 'external_sdk';
export type IdentityType = 'anonymous_fingerprint' | 'authenticated_account';

export type DemandIntent = {
  intent_id: string;
  normalized_text: string;
  raw_text: string;
  content_hash: string;
  actor_id: string;
  identity_type: IdentityType;
  session_id?: string;
  source: DemandSource;
  packet_id?: string;
  embedding?: number[];
  consent_share: boolean;
  observed_at: string;
};

export type IntentObservation = DemandIntent & {
  _v: 1;
};

export type SocketRegistration = {
  actor_id: string;
  identity_type: IdentityType;
  consent: { share_intents: boolean };
  registered_at: string;
};
