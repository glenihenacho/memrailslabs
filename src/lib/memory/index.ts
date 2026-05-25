import type { EvidenceClaim } from '@/types/evidence';
import type { MemoryPacket, RetrievalLayer } from '@/types/packet';
import type { QueryInput } from '@/types/memory';
import { loadCorpus } from './corpus';
import { grepLayer } from './grep';
import { keyLayer } from './key';
import { semanticLayer } from './semantic';
import { evidenceLayer } from './evidence';
import { compressLayer } from './compress';
import { buildPacket, buildPacketFromCandidates } from './packet';
import { logPacket } from '@/lib/ledger/events';
import { savePacket, loadPacket } from './store';

const HIGH_CONFIDENCE = 0.85;
const SYNTHESIS_INTENTS = new Set(['summarize', 'compare', 'extract']);

function mergeUnique(existing: EvidenceClaim[], next: EvidenceClaim[]): EvidenceClaim[] {
  const seen = new Set(existing.map((c) => c.id));
  return [...existing, ...next.filter((c) => !seen.has(c.id))];
}

export async function query(input: QueryInput): Promise<MemoryPacket> {
  const intent = input.intent ?? 'answer';
  const maxTokens = input.max_tokens ?? 600;

  const corpus = loadCorpus();
  const overallStart = Date.now();

  // L1 → L2 → L3 — cheapest filters first (§2 Rule 2).
  const cheapLayers = [grepLayer, keyLayer, semanticLayer] as const;
  let candidates: EvidenceClaim[] = [];
  let resolvedLayer: RetrievalLayer = 'L1_GREP';
  let earlyResolved = false;

  for (const layer of cheapLayers) {
    const result = layer(input.query, corpus);
    candidates = mergeUnique(candidates, result.candidates);
    if (result.resolved) {
      resolvedLayer = result.layer;
      earlyResolved = true;
      break;
    }
    resolvedLayer = result.layer;
  }

  // L4 — evidence filter always runs as a quality gate.
  const evidenceResult = evidenceLayer(input.query, candidates);
  const filtered = evidenceResult.candidates;

  // L5 — fire only when the cheap layers didn't resolve, the intent demands
  // synthesis, or no candidate clears the high-confidence bar (§2 Rule 2).
  // Single high-confidence answers stay at L1/L2 and skip the compressor.
  const topConfidence = filtered.reduce((max, c) => Math.max(max, c.confidence), 0);
  const needsCompress =
    !earlyResolved ||
    SYNTHESIS_INTENTS.has(intent) ||
    topConfidence < HIGH_CONFIDENCE;

  let packet: MemoryPacket;
  if (needsCompress) {
    const { packet: body, compressor } = compressLayer(input.query, filtered, maxTokens);
    packet = buildPacket({
      query: input.query,
      intent,
      body,
      candidates: filtered,
      resolved_layer: 'L5_COMPRESS',
      model_or_compressor: compressor,
    });
  } else {
    packet = buildPacketFromCandidates({
      query: input.query,
      intent,
      candidates: filtered.length > 0 ? filtered : candidates,
      resolved_layer: resolvedLayer,
    });
  }

  const latency = Date.now() - overallStart;
  savePacket(packet);
  logPacket(packet, latency);
  return packet;
}

export function inspect(packet_id: string): MemoryPacket | null {
  return loadPacket(packet_id);
}
