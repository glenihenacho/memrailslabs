import type { EvidenceClaim } from '@/types/evidence';
import type { MemoryRecord } from '@/types/governed';
import type { BundleMemory } from '@/types/bundle';
import type { MemoryPacket } from '@/types/packet';
import { compressLayer } from './compress';
import { evidenceLayer } from './evidence';
import { buildPacket } from './packet';

/**
 * Bundle → packet bridge.
 *
 * The packet contract (CLAUDE.md §6, `knowledge/claims/packet-contract.md`)
 * survives the reconcile: when a caller wants a single synthesized answer
 * instead of raw governed memories, we compress the top bundle memories into a
 * provenance-bearing packet. Synthesis stays the last resort, not the default.
 */
export function recordToClaim(record: MemoryRecord): EvidenceClaim {
  return {
    id: record.memory_id,
    source_file: record.source_file,
    claim: record.content,
    confidence: record.confidence,
    contradictions: record.contradictions.length ? record.contradictions : undefined,
    tags: record.tags,
    aliases: record.aliases,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

export function buildPacketFromBundle(
  taskContext: string,
  memories: BundleMemory[],
  registry: MemoryRecord[],
): MemoryPacket {
  const byId = new Map(registry.map((r) => [r.memory_id, r]));
  const claims: EvidenceClaim[] = memories
    .map((m) => byId.get(m.memory_id))
    .filter((r): r is MemoryRecord => Boolean(r))
    .map(recordToClaim);

  // Contract §5.5: synthesis only ever sees evidence above the floor. The
  // bundle itself may carry below-floor memories (the caller sees confidence
  // per memory); a synthesized packet must not silently blend them.
  const gated = evidenceLayer(taskContext, claims).candidates;

  const { packet: body, compressor } = compressLayer(taskContext, gated, 600);
  return buildPacket({
    query: taskContext,
    intent: 'summarize',
    body,
    candidates: gated,
    resolved_layer: 'L5_COMPRESS',
    model_or_compressor: compressor,
  });
}
