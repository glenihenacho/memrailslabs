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
import { runEvals, type GoldenCase } from '@/lib/memory/evals';
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
