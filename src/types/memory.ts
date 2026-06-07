import type { PacketIntent } from './packet';
import type { IdentityType } from './demand';

export type QueryInput = {
  query: string;
  intent?: PacketIntent;
  max_tokens?: number;
  session_id?: string;
  endpoint_id?: string;
  actor_id?: string;
  identity_type?: IdentityType;
};
