import type { EvidenceClaim } from './evidence';

export type RetrievalLayer =
  | 'L1_GREP'
  | 'L2_KEY'
  | 'L3_SEMANTIC'
  | 'L4_EVIDENCE'
  | 'L5_COMPRESS';

export type RetrievalResult = {
  query: string;
  layer: RetrievalLayer;
  latency_ms: number;
  candidates: EvidenceClaim[];
  resolved: boolean;
  reason: string;
};

export type PacketIntent =
  | 'answer'
  | 'summarize'
  | 'compare'
  | 'extract'
  | 'refactor'
  | 'route';

export type MemoryPacket = {
  packet_id: string;
  query: string;
  intent: PacketIntent;
  packet: string;
  confidence: number;
  tokens: number;
  contradictions_surfaced: number;
  evidence: Array<{
    claim_id: string;
    weight: number;
    source_file: string;
  }>;
  input_hash: string;
  output_hash: string;
  model_or_compressor: string;
  resolved_layer: RetrievalLayer;
  created_at: string;
};
