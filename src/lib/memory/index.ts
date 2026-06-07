import type { EvidenceClaim } from '@/types/evidence';
import type { MemoryPacket, RetrievalLayer } from '@/types/packet';
import type { QueryInput } from '@/types/memory';
import type { VoucherResult } from '@/types/payments';
import { loadCorpus } from './corpus';
import { grepLayer } from './grep';
import { keyLayer } from './key';
import { semanticLayer } from './semantic';
import { evidenceLayer } from './evidence';
import { compressLayer } from './compress';
import { buildPacket, buildPacketFromCandidates } from './packet';
import { logPacket } from '@/lib/ledger/events';
import { billPacket } from '@/lib/payments/sessions';
import { loadEndpoint } from '@/lib/endpoints/store';
import { savePacket, loadPacket } from './store';
import { observeIntent, markFulfilled } from '@/lib/demand/observe';

const HIGH_CONFIDENCE = 0.85;
const SYNTHESIS_INTENTS = new Set(['summarize', 'compare', 'extract']);

function mergeUnique(existing: EvidenceClaim[], next: EvidenceClaim[]): EvidenceClaim[] {
  const seen = new Set(existing.map((c) => c.id));
  return [...existing, ...next.filter((c) => !seen.has(c.id))];
}

export async function query(input: QueryInput): Promise<MemoryPacket> {
  const intent = input.intent ?? 'answer';
  const maxTokens = input.max_tokens ?? 600;

  if (input.endpoint_id) {
    const ep = loadEndpoint(input.endpoint_id);
    if (!ep) throw new EndpointNotFound(input.endpoint_id);
    if (ep.status !== 'live') throw new EndpointNotLive(ep.endpoint_id, ep.status);
  }

  const observation = observeIntent({
    raw_text: input.query,
    source: 'memory_query',
    actor_id: input.actor_id,
    identity_type: input.identity_type,
    session_id: input.session_id,
  });

  // Per-actor corpus when registered; falls back to global knowledge/ otherwise.
  const corpus = loadCorpus({ actor_id: observation.actor_id });
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
  const voucher: VoucherResult | null = input.session_id
    ? billPacket({ session_id: input.session_id, packet_id: packet.packet_id })
    : null;
  if (voucher && !voucher.ok) {
    throw new PaymentRequired(voucher.reason, voucher.session_id);
  }
  savePacket(packet);
  logPacket(packet, latency, voucher && voucher.ok ? voucher : null, input.endpoint_id);
  markFulfilled(observation.intent_id, packet.packet_id, observation.actor_id, observation.session_id);
  return packet;
}

export class PaymentRequired extends Error {
  reason: string;
  session_id: string;
  constructor(reason: string, session_id: string) {
    super(`payment_required: ${reason}`);
    this.name = 'PaymentRequired';
    this.reason = reason;
    this.session_id = session_id;
  }
}

export class EndpointNotFound extends Error {
  endpoint_id: string;
  constructor(endpoint_id: string) {
    super(`endpoint_not_found: ${endpoint_id}`);
    this.name = 'EndpointNotFound';
    this.endpoint_id = endpoint_id;
  }
}

export class EndpointNotLive extends Error {
  endpoint_id: string;
  status: string;
  constructor(endpoint_id: string, status: string) {
    super(`endpoint_not_live: ${endpoint_id} is ${status}`);
    this.name = 'EndpointNotLive';
    this.endpoint_id = endpoint_id;
    this.status = status;
  }
}

export function inspect(packet_id: string): MemoryPacket | null {
  return loadPacket(packet_id);
}
