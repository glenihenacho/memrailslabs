/**
 * Evals harness (C5.5) — the CI quality gate for C6.
 *
 * Runs the fixed golden query set (tests/evals/golden.json) against the
 * committed knowledge corpus and asserts the recorded gates: inclusion
 * recall, top-hit rate, evidence-floor compliance, and token efficiency.
 * C6's model-planned retrieval must pass these same gates — at equal or
 * lower token cost — before any default flip; the heuristic tree stays the
 * permanent fallback.
 *
 * Also gates omission-reason correctness on a seeded lifecycle fixture,
 * which the corpus-only golden set cannot express.
 */
import { beforeEach, describe, it, expect } from 'vitest';
import { resetData } from '../conformance/helpers';
import { runEvals, meetsGates, earnsPromotion, type GoldenCase, type EvalGates } from '@/lib/memory/evals';
import { getPlanner, corpusPlanner, DEFAULT_PLANNER } from '@/lib/memory/planner';
import { write } from '@/lib/memory/write';
import { supersede } from '@/lib/memory/lifecycle';
import { retrieve } from '@/lib/memory/retrieve';
import golden from './golden.json';

describe('C5.5 — retrieval evals (quality gate for C6)', () => {
  beforeEach(resetData);

  it('meets the recorded baseline gates on the golden query set', () => {
    const report = runEvals(golden.cases as GoldenCase[]);

    // Per-case reporting first, so a regression names the failing case.
    for (const c of report.cases) {
      expect(c.missing, `case ${c.id} missing goldens`).toEqual([]);
      expect(c.floor_violations, `case ${c.id} cited below-floor evidence`).toBe(0);
    }
    expect(report.mean_recall).toBeGreaterThanOrEqual(golden.gates.min_mean_recall);
    expect(report.top_hit_rate).toBeGreaterThanOrEqual(golden.gates.min_top_hit_rate);
    expect(report.floor_violations).toBeLessThanOrEqual(golden.gates.max_floor_violations);
    expect(report.median_tokens).toBeLessThanOrEqual(golden.gates.max_median_tokens);
  });

  it('C6: the default planner flip stays earned — A/B re-verified on every run', () => {
    const cases = golden.cases as GoldenCase[];
    const gates = golden.gates as EvalGates;

    const incumbent = runEvals(cases, { planner: golden.planner_promotion.incumbent });
    const candidate = runEvals(cases, { planner: golden.planner_promotion.candidate });

    // The incumbent heuristic must itself stay conforming — it is the
    // permanent fallback, and a fallback that fails the gates is no fallback.
    expect(meetsGates(incumbent, gates)).toEqual([]);

    // The recorded promotion decision must match what the gate awards today.
    // If corpus@v1 ever regresses on recall, top-hit, floor, or token cost,
    // this fails and the default reverts with the record — no silent drift.
    const promotion = earnsPromotion(candidate, incumbent, gates);
    expect(promotion.reasons).toEqual([]);
    expect(promotion.promote).toBe(golden.planner_promotion.promoted);
    expect(DEFAULT_PLANNER === 'corpus').toBe(golden.planner_promotion.promoted);
    expect(getPlanner().name).toBe(golden.planner_promotion.promoted ? corpusPlanner.name : golden.planner_promotion.incumbent);
  });

  it('states correct omission reasons for governed exclusions', () => {
    const old = write({ content: 'Evals: superseded pricing fact.', tags: ['evals'], confidence: 0.9 });
    supersede(old.memory_id, {
      new_memory: { content: 'Evals: corrected pricing fact.', tags: ['evals'], confidence: 0.95 },
    });
    const bundle = retrieve({ task_context: 'evals superseded pricing fact' });
    const omission = bundle.omitted.find((o) => o.memory_id === old.memory_id);
    expect(omission?.reason).toContain('Superseded');
  });
});
