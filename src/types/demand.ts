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

export type IntentCluster = {
  cluster_id: string;
  canonical_text: string;
  observation_ids: string[];
  actor_ids: string[];
  identity_mix: { authenticated: number; anonymous: number };
  first_observed: string;
  last_observed: string;
};

export type IntentStakeStatus = 'active' | 'slashed' | 'released';
export type IntentStakeSlashReason = 'sybil' | 'rate_abuse' | 'fabricated';

export type IntentStake = {
  stake_id: string;
  actor_id: string;
  cluster_id: string;
  amount_cents: number;
  status: IntentStakeStatus;
  reason_if_slashed?: IntentStakeSlashReason;
  created_at: string;
  updated_at: string;
};

export type Window = { since: string; until: string };

export type PopularityScore = {
  cluster_id: string;
  canonical_text: string;
  observations: number;
  frequency: number;
  velocity: number;
  breadth: number;
  genuineness: number;
  composite: number;
  actor_ids: string[];
  window: Window;
};
