import { randomUUID } from 'node:crypto';
import type { EvidenceClaim } from '@/types/evidence';
import type { MemoryPacket, PacketIntent, RetrievalLayer } from '@/types/packet';
import { sha256 } from '@/lib/observability/hash';
import { countContradictions } from './evidence';
import { estimateTokens } from './compress';

export type BuildPacketArgs = {
  query: string;
  intent: PacketIntent;
  body: string;
  candidates: EvidenceClaim[];
  resolved_layer: RetrievalLayer;
  model_or_compressor: string;
};

export function buildPacket({
  query,
  intent,
  body,
  candidates,
  resolved_layer,
  model_or_compressor,
}: BuildPacketArgs): MemoryPacket {
  const total = candidates.reduce((sum, c) => sum + c.confidence, 0);
  const confidence =
    candidates.length === 0 ? 0 : Number((total / candidates.length).toFixed(3));

  const evidence = candidates.map((c) => ({
    claim_id: c.id,
    weight: candidates.length === 0 ? 0 : Number((c.confidence / total).toFixed(3)),
    source_file: c.source_file,
  }));

  const input_hash = sha256(JSON.stringify({ query, intent }));
  const output_hash = sha256(body);

  return {
    packet_id: `pkt_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    query,
    intent,
    packet: body,
    confidence,
    tokens: estimateTokens(body),
    contradictions_surfaced: countContradictions(candidates),
    evidence,
    input_hash,
    output_hash,
    model_or_compressor,
    resolved_layer,
    created_at: new Date().toISOString(),
  };
}

export function buildPacketFromCandidates(
  args: Omit<BuildPacketArgs, 'body' | 'model_or_compressor'>,
): MemoryPacket {
  const top = args.candidates[0];
  const body = top
    ? `${top.claim}\n\n(sourced from ${top.source_file}, claim ${top.id})`
    : `No claims matched "${args.query}".`;
  return buildPacket({
    ...args,
    body,
    model_or_compressor: 'retrieval-only',
  });
}
