/**
 * Context bundle — the primary output of `memory.retrieve()`.
 *
 * The bundle is the governed evolution of the packet: where a {@link
 * import('./packet').MemoryPacket} is a single synthesized answer, a bundle is a
 * scored, explainable set of governed memories plus the trace of how they were
 * selected. A bundle MAY carry a synthesized packet when the caller asks for
 * synthesis, but its default job is to hand the local agent dense, governed
 * context for local inference.
 */

import type { MemoryStatus } from './governed';
import type { MemoryPacket } from './packet';
import type { RetrievalUsage } from './billing';

export type RetrievalMode =
  | 'exact' // SQL/entity lookup
  | 'tree' // MemoryIndex reasoning retrieval (default)
  | 'hybrid' // tree + exact + optional vector fallback
  | 'hot' // cached recent memory
  | 'debug'; // tree + full retrieval trace

export type BundleMemory = {
  memory_id: string;
  summary: string;
  content?: string;
  confidence: number;
  status: MemoryStatus;
  reason_selected: string;
  score: number;
  tokens: number;
  source_file: string;
  index_path: string;
  evidence_refs?: string[];
};

export type OmittedMemory = {
  memory_id: string;
  reason: string;
};

/** Transparent breakdown of the ranking formula for a single candidate. */
export type ScoreBreakdown = {
  memory_id: string;
  relevance: number;
  scope_match: number;
  recency: number;
  confidence: number;
  usage_success: number;
  staleness_penalty: number;
  contradiction_penalty: number;
  sensitivity_penalty: number;
  token_cost_penalty: number;
  final_score: number;
};

export type RetrievalTrace = {
  mode: RetrievalMode;
  root_nodes_visited: number;
  branches_selected: string[];
  policy_filters_applied: string[];
  candidates_considered: number;
  scoring?: ScoreBreakdown[];
};

export type ContextBundle = {
  context_bundle_id: string;
  retrieval_id: string;
  query: string;
  scope: {
    owner_id: string;
    project_id: string;
    agent_id?: string | null;
  };
  mode: RetrievalMode;
  memories: BundleMemory[];
  omitted: OmittedMemory[];
  tokens_returned: number;
  token_budget: number;
  retrieval_trace: RetrievalTrace;
  /** Present only when synthesis was requested (`include_packet: true`). */
  packet?: MemoryPacket;
  /** Metered usage — 1 successful retrieve = 1 billable retrieval. */
  usage: RetrievalUsage;
  latency_ms: number;
  created_at: string;
};

export type RetrieveInput = {
  owner_id?: string;
  project_id?: string;
  agent_id?: string;
  task_context: string;
  max_tokens?: number;
  retrieval_mode?: RetrievalMode;
  include_evidence?: boolean;
  include_disputed?: boolean;
  /** When true, also synthesize a compressed packet from the top memories. */
  include_packet?: boolean;
};
