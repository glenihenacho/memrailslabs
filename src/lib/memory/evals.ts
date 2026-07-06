import type { ContextBundle } from '@/types/bundle';
import { retrieve } from './retrieve';
import { DEFAULT_FLOOR } from './evidence';

/**
 * Evals harness (C5.5) — the quality gate for C6.
 *
 * A fixed query set with golden bundles, run against the committed knowledge
 * corpus. Four measures, matching the plan:
 *
 *   recall      — every `must_include` id present in the returned bundle
 *   top_hit     — the first-ranked memory is one of the goldens
 *   floor       — synthesized packets never cite evidence below the 0.75 floor
 *   efficiency  — bundles stay well inside the token budget
 *
 * Deterministic by construction (lexical tree + additive scorer, committed
 * corpus), so thresholds are hard CI gates: the C6 model-planned retrieval
 * must beat the heuristic baseline here — at equal or lower token cost —
 * before any default flip.
 */

export type GoldenCase = {
  /** Stable case id for reporting. */
  id: string;
  task_context: string;
  /** Memory ids the bundle must contain. */
  must_include: string[];
};

export type EvalCaseResult = {
  id: string;
  recall: number;
  top_hit: boolean;
  missing: string[];
  tokens_returned: number;
  floor_violations: number;
};

export type EvalReport = {
  cases: EvalCaseResult[];
  mean_recall: number;
  top_hit_rate: number;
  floor_violations: number;
  median_tokens: number;
  token_budget: number;
};

const EVAL_BUDGET = 1800;

function evalCase(golden: GoldenCase): EvalCaseResult {
  const bundle: ContextBundle = retrieve({
    task_context: golden.task_context,
    max_tokens: EVAL_BUDGET,
    include_packet: true,
  });
  const returned = new Set(bundle.memories.map((m) => m.memory_id));
  const missing = golden.must_include.filter((id) => !returned.has(id));
  const recall =
    golden.must_include.length === 0
      ? 1
      : (golden.must_include.length - missing.length) / golden.must_include.length;

  // Floor compliance (§5.5): every cited packet evidence is a bundle memory
  // at or above the floor.
  const confidenceById = new Map(bundle.memories.map((m) => [m.memory_id, m.confidence]));
  const floor_violations = (bundle.packet?.evidence ?? []).filter(
    (e) => (confidenceById.get(e.claim_id) ?? 1) < DEFAULT_FLOOR,
  ).length;

  return {
    id: golden.id,
    recall: Number(recall.toFixed(3)),
    top_hit: golden.must_include.includes(bundle.memories[0]?.memory_id ?? ''),
    missing,
    tokens_returned: bundle.tokens_returned,
    floor_violations,
  };
}

export function runEvals(goldens: GoldenCase[]): EvalReport {
  const cases = goldens.map(evalCase);
  const tokens = cases.map((c) => c.tokens_returned).sort((a, b) => a - b);
  return {
    cases,
    mean_recall: Number((cases.reduce((s, c) => s + c.recall, 0) / cases.length).toFixed(3)),
    top_hit_rate: Number((cases.filter((c) => c.top_hit).length / cases.length).toFixed(3)),
    floor_violations: cases.reduce((s, c) => s + c.floor_violations, 0),
    median_tokens: tokens[Math.floor(tokens.length / 2)] ?? 0,
    token_budget: EVAL_BUDGET,
  };
}
