import { randomUUID } from 'node:crypto';
import type { MemoryRecord } from '@/types/governed';
import type {
  BundleMemory,
  ContextBundle,
  OmittedMemory,
  RetrievalMode,
  RetrieveInput,
  ScoreBreakdown,
} from '@/types/bundle';
import { loadRegistry } from './registry';
import { buildIndex, selectBranches } from './index-tree';
import { evaluatePolicy, defaultScope, POLICY_FILTERS, type ScopeRequest } from './scope';
import { scoreRecord, tokenize } from './ranking';
import { estimateTokens } from './compress';
import { recordRetrieval } from './telemetry';
import { buildPacketFromBundle } from './synthesize';
import { meterBundle } from './meter';

const DEFAULT_BUDGET = 1800;

function bundleId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

function exactMatches(records: MemoryRecord[], taskTokens: Set<string>): Set<string> {
  const hits = new Set<string>();
  for (const r of records) {
    const keys = [r.memory_id.toLowerCase(), ...r.aliases.map((a) => a.toLowerCase()), ...r.tags.map((t) => t.toLowerCase())];
    if (keys.some((k) => taskTokens.has(k) || k.split(/[_\s-]+/).some((part) => taskTokens.has(part)))) {
      hits.add(r.memory_id);
    }
  }
  return hits;
}

/**
 * `memory.retrieve()` — the core primitive.
 *
 * Pipeline (see `knowledge/governed-retrieval.md`):
 *   auth/scope → policy filter → tree branch selection → candidate gather →
 *   freshness/confidence/contradiction ranking → token-budgeted bundle →
 *   telemetry.
 *
 * Returns a {@link ContextBundle}: governed, scored, explainable context for
 * local inference. Optionally synthesizes a packet when `include_packet`.
 */
export function retrieve(input: RetrieveInput): ContextBundle {
  const start = Date.now();
  const mode: RetrievalMode = input.retrieval_mode ?? 'tree';
  const budget = input.max_tokens ?? DEFAULT_BUDGET;
  const scope: ScopeRequest = {
    ...defaultScope({
      owner_id: input.owner_id,
      project_id: input.project_id,
      agent_id: input.agent_id ?? null,
    }),
    include_disputed: input.include_disputed,
  };

  const registry = loadRegistry();
  const taskTokens = new Set(tokenize(input.task_context));

  // 1. Policy gate — partition into in-scope vs omitted-with-reason.
  const inScope: MemoryRecord[] = [];
  const policyOmitted: OmittedMemory[] = [];
  for (const record of registry) {
    const decision = evaluatePolicy(record, scope);
    if (decision.allowed) {
      inScope.push(record);
    } else if (
      // Only surface omissions for memory the caller could plausibly expect:
      // same owner + project, excluded by status/sensitivity rather than tenancy.
      record.scope.owner_id === scope.owner_id &&
      record.scope.project_id === scope.project_id &&
      ['superseded', 'disputed', 'restricted_sensitivity', 'expired', 'tombstoned'].includes(
        decision.reason,
      )
    ) {
      policyOmitted.push({ memory_id: record.memory_id, reason: omissionReason(decision.reason) });
    }
  }

  // 2. Candidate gather by mode.
  const index = buildIndex(inScope);
  const { selected, rootsVisited } = selectBranches(index, input.task_context);
  const branchPaths = selected.map((n) => n.path);
  const branchMemberIds = new Set(selected.flatMap((n) => n.member_ids));

  let candidateIds: Set<string>;
  if (mode === 'exact') {
    candidateIds = exactMatches(inScope, taskTokens);
  } else if (mode === 'hot') {
    candidateIds = new Set(
      [...inScope]
        .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
        .slice(0, 8)
        .map((r) => r.memory_id),
    );
  } else if (mode === 'hybrid') {
    candidateIds = new Set([...branchMemberIds, ...exactMatches(inScope, taskTokens)]);
  } else {
    // tree (and debug)
    candidateIds = branchMemberIds;
  }

  const candidates = inScope.filter((r) => candidateIds.has(r.memory_id));

  // 3. Rank with the transparent formula.
  const scoring: ScoreBreakdown[] = candidates.map((r) => scoreRecord(r, taskTokens));
  const scoreById = new Map(scoring.map((s) => [s.memory_id, s]));
  const ranked = [...candidates].sort(
    (a, b) => (scoreById.get(b.memory_id)?.final_score ?? 0) - (scoreById.get(a.memory_id)?.final_score ?? 0),
  );

  // 4. Token-budgeted assembly.
  const memories: BundleMemory[] = [];
  const omitted: OmittedMemory[] = [...policyOmitted];
  let tokens = 0;

  for (const record of ranked) {
    const includeContent = input.include_evidence ?? false;
    const piece = includeContent ? `${record.summary}\n${record.content}` : record.summary;
    const memTokens = estimateTokens(piece);
    const score = scoreById.get(record.memory_id);

    if (tokens + memTokens > budget && memories.length > 0) {
      omitted.push({ memory_id: record.memory_id, reason: 'Dropped: token budget exhausted.' });
      continue;
    }
    tokens += memTokens;
    memories.push({
      memory_id: record.memory_id,
      summary: record.summary,
      content: includeContent ? record.content : undefined,
      confidence: record.confidence,
      status: record.status,
      reason_selected: reasonSelected(record, score, branchPaths),
      score: score?.final_score ?? 0,
      tokens: memTokens,
      source_file: record.source_file,
      index_path: record.index_path,
      evidence_refs: input.include_evidence
        ? record.source_refs.flatMap((s) => (s.ref ?? s.id ? [s.ref ?? s.id!] : []))
        : undefined,
    });
  }

  const retrieval_id = bundleId('ret');
  const bundle: ContextBundle = {
    context_bundle_id: bundleId('ctx'),
    retrieval_id,
    query: input.task_context,
    scope: { owner_id: scope.owner_id, project_id: scope.project_id, agent_id: scope.agent_id },
    mode,
    memories,
    omitted,
    tokens_returned: tokens,
    token_budget: budget,
    retrieval_trace: {
      mode,
      root_nodes_visited: rootsVisited,
      branches_selected: branchPaths,
      policy_filters_applied: [...POLICY_FILTERS],
      candidates_considered: candidates.length,
      scoring: mode === 'debug' ? scoring : undefined,
    },
    usage: { billable_retrievals: 0, billable_units: 0, credits_remaining: 0, credit_exhausted: false },
    latency_ms: Date.now() - start,
    created_at: new Date().toISOString(),
  };

  if (input.include_packet) {
    bundle.packet = buildPacketFromBundle(input.task_context, memories, registry);
  }

  // Meter the retrieval (1 successful retrieve = 1 billable unit) before
  // persisting, so the stored bundle carries its usage. The meter itself lives
  // in the billing shell and reaches the kernel through the seam in meter.ts.
  bundle.usage = meterBundle(bundle);

  recordRetrieval(bundle);
  return bundle;
}

function reasonSelected(
  record: MemoryRecord,
  score: ScoreBreakdown | undefined,
  branchPaths: string[],
): string {
  const branch = branchPaths.includes(record.index_path)
    ? record.index_path.split('/').filter(Boolean).pop()
    : null;
  const rel = score ? score.relevance.toFixed(2) : '0';
  if (branch) {
    return `Selected from branch ${branch} (relevance ${rel}, confidence ${record.confidence}).`;
  }
  return `Matched by ${record.memory_type} relevance ${rel}.`;
}

function omissionReason(reason: string): string {
  switch (reason) {
    case 'superseded':
      return 'Superseded by a newer memory version.';
    case 'disputed':
      return 'Disputed — excluded unless explicitly requested.';
    case 'restricted_sensitivity':
      return 'Restricted sensitivity — suppressed from retrieval.';
    case 'expired':
      return 'Expired — past its validity window.';
    case 'tombstoned':
      return 'Forgotten — tombstoned on request.';
    default:
      return reason;
  }
}
