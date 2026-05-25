import type { PacketIntent } from './packet';

export type QueryInput = {
  query: string;
  intent?: PacketIntent;
  max_tokens?: number;
};
