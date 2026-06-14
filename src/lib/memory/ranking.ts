import type { MemoryRecord } from '@/types/governed';
import type { ScoreBreakdown } from '@/types/bundle';

/**
 * Transparent ranking. Memory infrastructure needs explainability, so the score
 * is an additive formula whose terms are all reported in the retrieval trace:
 *
 *   final = relevance + scope_match + recency + confidence + usage_success
 *           − staleness − contradiction − sensitivity − token_cost
 *
 * `relevance` is supplied by the retrieval layer (tree overlap / exact match).
 */

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has',
  'have', 'in', 'is', 'it', 'of', 'on', 'or', 'the', 'to', 'was', 'were',
  'with', 'what', 'how', 'when', 'why', 'do', 'does', 'this', 'that', 'i',
  'detail', 'build', 'complete',
]);

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Lexical relevance of a record to a task context, in [0, 1]. */
export function relevanceScore(record: MemoryRecord, taskTokens: Set<string>): number {
  if (taskTokens.size === 0) return 0;
  const haystack = new Set(
    tokenize(`${record.summary} ${record.content} ${record.tags.join(' ')} ${record.index_path}`),
  );
  let overlap = 0;
  for (const t of taskTokens) if (haystack.has(t)) overlap += 1;
  return overlap / taskTokens.size;
}

function recencyScore(record: MemoryRecord, now: number): number {
  const updated = Date.parse(record.updated_at);
  if (Number.isNaN(updated)) return 0;
  const ageDays = Math.max(0, (now - updated) / 86_400_000);
  // Half-life ~180 days, capped contribution of 0.2.
  return Number((0.2 * Math.exp(-ageDays / 180)).toFixed(4));
}

function stalenessPenalty(record: MemoryRecord, now: number): number {
  const updated = Date.parse(record.updated_at);
  if (Number.isNaN(updated)) return 0;
  const ageDays = Math.max(0, (now - updated) / 86_400_000);
  return ageDays > 365 ? 0.15 : 0;
}

export function scoreRecord(
  record: MemoryRecord,
  taskTokens: Set<string>,
  opts: { now?: number; usageSuccess?: number } = {},
): ScoreBreakdown {
  const now = opts.now ?? Date.now();
  const relevance = Number(relevanceScore(record, taskTokens).toFixed(4));
  const scope_match = record.scope.agent_id ? 0.1 : 0.05; // agent-specific is a tighter fit
  const recency = recencyScore(record, now);
  const confidence = Number((record.confidence * 0.3).toFixed(4));
  const usage_success = Number((opts.usageSuccess ?? 0).toFixed(4));
  const staleness_penalty = stalenessPenalty(record, now);
  const contradiction_penalty = record.contradictions.length > 0 ? 0.1 : 0;
  const sensitivity_penalty = record.sensitivity === 'sensitive' ? 0.05 : 0;
  const token_cost_penalty = Number((Math.min(record.content.length / 4, 600) / 6000).toFixed(4));

  const final_score = Number(
    (
      relevance +
      scope_match +
      recency +
      confidence +
      usage_success -
      staleness_penalty -
      contradiction_penalty -
      sensitivity_penalty -
      token_cost_penalty
    ).toFixed(4),
  );

  return {
    memory_id: record.memory_id,
    relevance,
    scope_match,
    recency,
    confidence,
    usage_success,
    staleness_penalty,
    contradiction_penalty,
    sensitivity_penalty,
    token_cost_penalty,
    final_score,
  };
}
