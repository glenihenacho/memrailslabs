import type { MemoryRecord } from '@/types/governed';
import type { RelevanceSignals, ScoreBreakdown } from '@/types/bundle';
import { stemSet, weightedOverlap, tokenize } from './lexical';

/**
 * Transparent ranking. Memory infrastructure needs explainability, so the score
 * is an additive formula whose terms are all reported in the retrieval trace:
 *
 *   final = relevance + scope_match + recency + confidence + usage_success
 *           − staleness − contradiction − sensitivity − token_cost
 *
 * `relevance` is no longer a flat token count — it is a blend of the evolved
 * L1–L3 layer signals (see {@link relevanceSignals}):
 *
 *   relevance = 0.5·semantic(L3) + 0.3·lexical(L1) + 0.2·structural(L2)
 *
 * L4 (evidence quality) stays expressed through `confidence` and the
 * contradiction/sensitivity penalties below.
 */

// Re-exported so existing callers (write dedup, index-tree) keep one tokenizer.
export { tokenize } from './lexical';

/** Query context threaded through ranking so IDF/stems are computed once. */
export type QueryContext = {
  raw: string;
  stems: Set<string>;
  idf: Map<string, number>;
};

const BLEND = { semantic: 0.5, lexical: 0.3, structural: 0.2 } as const;

function round(n: number): number {
  return Number(n.toFixed(4));
}

/**
 * The three retrieval-layer signals, combined into the governed relevance.
 *   L1 lexical    — literal phrase / raw token coverage.
 *   L2 structural — query mentions the record's id, alias, or tag.
 *   L3 semantic   — IDF-weighted, stemmed token overlap.
 */
export function relevanceSignals(
  record: MemoryRecord,
  q: QueryContext,
  opts: { skipSemantic?: boolean } = {},
): RelevanceSignals {
  // L1 — literal. Exact phrase presence is the strongest cheap signal; failing
  // that, fall back to raw (unstemmed) token coverage.
  const hay = `${record.summary} ${record.content}`.toLowerCase();
  const phrase = q.raw.trim().toLowerCase();
  let lexical = 0;
  if (phrase.length > 2 && hay.includes(phrase)) {
    lexical = 1;
  } else {
    const qTok = new Set(tokenize(q.raw));
    const hTok = new Set(tokenize(`${record.summary} ${record.content} ${record.index_path}`));
    let overlap = 0;
    for (const t of qTok) if (hTok.has(t)) overlap += 1;
    lexical = qTok.size === 0 ? 0 : overlap / qTok.size;
  }

  // L2 — structural. Does the query name a key/alias/tag of this record?
  const qPadded = ` ${tokenize(q.raw).join(' ')} `;
  const keys = [record.memory_id, ...record.aliases, ...record.tags]
    .map((k) => k.toLowerCase())
    .filter(Boolean);
  let structural = 0;
  for (const key of keys) {
    if (qPadded.includes(` ${key} `)) {
      structural = 1;
      break;
    }
    const parts = key.split(/[_\s-]+/).filter((p) => p.length > 1);
    if (parts.length > 1 && parts.every((p) => qPadded.includes(` ${p} `))) {
      structural = Math.max(structural, 0.8);
    }
  }

  // L3 — semantic. IDF-weighted stemmed overlap is the recall backbone, but it
  // is the expensive signal; skip it when rigorous grep already resolved.
  const semantic = opts.skipSemantic
    ? 0
    : weightedOverlap(
        q.stems,
        stemSet(`${record.summary} ${record.content} ${record.tags.join(' ')} ${record.index_path}`),
        q.idf,
      );

  return { lexical: round(lexical), structural: round(structural), semantic };
}

/** Lexical relevance of a record to a task context, in [0, 1] (blended L1–L3). */
export function relevanceScore(record: MemoryRecord, q: QueryContext): number {
  const s = relevanceSignals(record, q);
  return round(BLEND.semantic * s.semantic + BLEND.lexical * s.lexical + BLEND.structural * s.structural);
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
  q: QueryContext,
  opts: { now?: number; usageSuccess?: number; skipSemantic?: boolean } = {},
): ScoreBreakdown {
  const now = opts.now ?? Date.now();
  const signals = relevanceSignals(record, q, { skipSemantic: opts.skipSemantic });
  // When grep already resolved, the semantic term is skipped; the two cheap
  // signals are renormalized to keep relevance on the same [0, 1] scale.
  const relevance = opts.skipSemantic
    ? round((0.6 * signals.lexical + 0.4 * signals.structural))
    : round(BLEND.semantic * signals.semantic + BLEND.lexical * signals.lexical + BLEND.structural * signals.structural);
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
    relevance_signals: signals,
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
