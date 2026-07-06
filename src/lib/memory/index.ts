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

  // L5 — only when low-tier retrieval didn't resolve, or the intent requires
  // synthesis (§7 L5 acceptance, §2 Rule 2).
  const needsCompress =
    !earlyResolved ||
    intent === 'summarize' ||
    intent === 'compare' ||
    intent === 'extract' ||
    filtered.length > 1;

  let packet: MemoryPacket;
  if (needsCompress && filtered.length > 0) {
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
  logPacket(packet, latency);
  return packet;
}

export function inspect(packet_id: string): MemoryPacket | null {
  // Phase 1 stores packets only via the JSONL ledger. For inspection we walk
  // the ledger and reconstruct the packet from the recorded event metadata
  // (the packet body itself isn't persisted server-side yet — see Phase 3).
  return null;
}

// ── Governed memory.retrieve() architecture ────────────────────────────────
// The packet path above (query/inspect) is the synthesis surface. The governed
// primitives below are the product's core: scoped, explainable, file-canonical
// memory retrieval for locally inferred agents.
export { retrieve } from './retrieve';
export { write } from './write';
export { supersede, dispute, restore, updateConfidence, forget } from './lifecycle';
export { loadRegistry, getRecord, DEFAULT_SCOPE } from './registry';
export { buildIndex, selectBranches, toMemoryMap } from './index-tree';
export {
  planBranches,
  getPlanner,
  registerPlanner,
  heuristicPlanner,
  corpusPlanner,
  DEFAULT_PLANNER,
} from './planner';
export type { BranchPlan, BranchPlanner } from './planner';
export { recordFeedback, findRetrieval } from './telemetry';

import { loadRegistry } from './registry';
import { buildIndex, toMemoryMap } from './index-tree';
import type { MemoryMapNode } from '@/types/index-tree';

/**
 * Project memory map (nested MemoryIndex view), scoped to an owner so project-id
 * collisions across tenants never mix records.
 */
export function memoryMap(project_id: string, owner_id?: string): MemoryMapNode[] {
  const records = loadRegistry().filter(
    (r) => r.scope.project_id === project_id && (owner_id === undefined || r.scope.owner_id === owner_id),
  );
  return toMemoryMap(buildIndex(records));
}
