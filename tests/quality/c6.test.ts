/**
 * MemoryIndex planner model — conversion phase C6.
 *
 * The planner seam (`plan(task_context, index) → BranchPlan`), the two
 * conforming planners, and the §9 guarantees (amendment v0.1.1): every plan
 * is named on the trace, plans are advisory — gates run in code after
 * planning — and heuristic@v1 is the permanent fallback. Runs in every
 * authority mode.
 */
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { resetData } from '../conformance/helpers';
import { write } from '@/lib/memory/write';
import { retrieve } from '@/lib/memory/retrieve';
import { recordFeedback } from '@/lib/memory/telemetry';
import { loadRegistry } from '@/lib/memory/registry';
import { buildIndex } from '@/lib/memory/index-tree';
import {
  planBranches,
  getPlanner,
  registerPlanner,
  heuristicPlanner,
  corpusPlanner,
  DEFAULT_PLANNER,
} from '@/lib/memory/planner';
import type { MemoryIndexNode } from '@/types/index-tree';
import { authorityMode, flushAuthority, getDb } from '@/lib/memory/authority';

const PROJECT = 'project_planner_c6';
const pgOnly = authorityMode() === 'postgres' ? describe : describe.skip;

// Planner selection must stay order-independent across suites: restore the
// pre-test MEMRAILS_PLANNER rather than unconditionally deleting it.
let previousPlanner: string | undefined;
beforeEach(() => {
  previousPlanner = process.env.MEMRAILS_PLANNER;
});
afterEach(() => {
  if (previousPlanner === undefined) delete process.env.MEMRAILS_PLANNER;
  else process.env.MEMRAILS_PLANNER = previousPlanner;
});

describe('C6.1 — every plan is named on the trace (§9, v0.1.1)', () => {
  beforeEach(resetData);

  it('records the default planner on every retrieval mode', () => {
    write({ content: 'Planner trace: subject memory.', project_id: PROJECT, tags: ['planner'], confidence: 0.9 });
    const defaultName = getPlanner().name;
    expect(getPlanner(DEFAULT_PLANNER).name).toBe(defaultName);
    for (const mode of ['tree', 'hybrid', 'exact', 'hot', 'debug'] as const) {
      const bundle = retrieve({ task_context: 'planner trace subject memory', project_id: PROJECT, retrieval_mode: mode });
      expect(bundle.retrieval_trace.planner, `mode ${mode}`).toBe(defaultName);
    }
  });

  it('switches planner via the MEMRAILS_PLANNER flag; unknown names resolve to the fallback', () => {
    write({ content: 'Planner flag: subject memory.', project_id: PROJECT, tags: ['planner'], confidence: 0.9 });

    process.env.MEMRAILS_PLANNER = 'heuristic';
    const heuristic = retrieve({ task_context: 'planner flag subject memory', project_id: PROJECT });
    expect(heuristic.retrieval_trace.planner).toBe(heuristicPlanner.name);

    process.env.MEMRAILS_PLANNER = 'corpus';
    const corpus = retrieve({ task_context: 'planner flag subject memory', project_id: PROJECT });
    expect(corpus.retrieval_trace.planner).toBe(corpusPlanner.name);

    // A typo'd planner name is a fallback event, not a silent substitution:
    // the heuristic is named AND the trace records the substitution.
    process.env.MEMRAILS_PLANNER = 'no_such_planner@v9';
    const unknown = retrieve({ task_context: 'planner flag subject memory', project_id: PROJECT });
    expect(unknown.retrieval_trace.planner).toBe(heuristicPlanner.name);
    expect(unknown.retrieval_trace.policy_filters_applied).toContain('planner_fallback');
  });
});

describe('C6.2 — corpus@v1 learns routing from feedback (behavior, not memories)', () => {
  beforeEach(resetData);

  it('demotes a down-rated branch and promotes an endorsed one past lexical ties', () => {
    // Six branches, lexically identical for the query — the tie forces the
    // 4-branch selection to be decided by branch order (heuristic) or by the
    // learned usage prior (corpus).
    // Contents are mutually dissimilar (write() dedupes near-identical
    // content); the lexical tie lives in the identical summaries, which is
    // all branch scoring reads (title + summary + path).
    const bodies = [
      'Alpha fixture: nebula kite parliament oxide harbor.',
      'Bravo fixture: glacier violin mustard photon ledge.',
      'Charlie fixture: ember sax lattice pigeon tundra.',
      'Delta fixture: quartz mango turbine fresco inlet.',
      'Echo fixture: willow comet saddle iodine parlor.',
      'Foxtrot fixture: basalt oboe currant zephyr mill.',
    ];
    const ids: string[] = [];
    for (let i = 1; i <= 6; i += 1) {
      const res = write({
        content: bodies[i - 1],
        summary: 'Planner corpus routing subject.',
        project_id: PROJECT,
        index_path: `/project/${PROJECT}/branch_${i}`,
        tags: [],
        confidence: 0.9,
      });
      ids.push(res.memory_id);
    }
    const index = buildIndex(loadRegistry({ force: true }).filter((r) => r.scope.project_id === PROJECT));
    const task = 'planner corpus routing subject';

    // Before any feedback the two planners agree exactly.
    const before = planBranches(task, index, 'corpus');
    expect(before.selected.map((n) => n.path)).toEqual(
      planBranches(task, index, 'heuristic').selected.map((n) => n.path),
    );
    expect(before.selected.map((n) => n.path)).toContain(`/project/${PROJECT}/branch_2`);
    expect(before.selected.map((n) => n.path)).not.toContain(`/project/${PROJECT}/branch_6`);

    // Real feedback loop: rate branch_2's memory down and branch_6's up.
    const bundle = retrieve({ task_context: task, project_id: PROJECT });
    recordFeedback({ retrieval_id: bundle.retrieval_id, rating: 'negative', memory_id: ids[1] });
    recordFeedback({ retrieval_id: bundle.retrieval_id, rating: 'positive', memory_id: ids[5] });

    const after = planBranches(task, index, 'corpus');
    expect(after.selected.map((n) => n.path)).not.toContain(`/project/${PROJECT}/branch_2`);
    expect(after.selected.map((n) => n.path)).toContain(`/project/${PROJECT}/branch_6`);

    // The heuristic ignores usage — its plan is unchanged. That is the
    // fallback property: routing regressions from bad feedback are always
    // one flag away from disappearing.
    expect(planBranches(task, index, 'heuristic').selected.map((n) => n.path)).toEqual(
      before.selected.map((n) => n.path),
    );
  });
});

describe('C6.3 — plans are advisory: gates run in code after planning (§9)', () => {
  beforeEach(resetData);

  it('a planner proposing restricted or out-of-scope memory cannot leak it', () => {
    const restricted = write({
      content: 'Planner gate: restricted secret.',
      project_id: PROJECT,
      sensitivity: 'restricted',
      confidence: 0.95,
    });
    const foreign = write({
      content: 'Planner gate: another tenant memory.',
      owner_id: 'user_other_tenant',
      project_id: PROJECT,
      confidence: 0.95,
    });
    const legit = write({
      content: 'Planner gate: legitimate memory.',
      project_id: PROJECT,
      tags: ['planner-gate'],
      confidence: 0.9,
    });

    // A hostile plan: one fabricated branch whose members are exactly the
    // memories policy must suppress, plus the legitimate one.
    const hostileNode: MemoryIndexNode = {
      node_id: 'node_hostile',
      owner_id: 'user_memrails',
      project_id: PROJECT,
      parent_node_id: null,
      node_type: 'branch',
      title: 'Hostile',
      summary: 'planner-proposed exfiltration branch',
      path: `/project/${PROJECT}/hostile`,
      depth: 3,
      status: 'active',
      member_ids: [restricted.memory_id, foreign.memory_id, legit.memory_id],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    registerPlanner('hostile_c6', {
      name: 'hostile@test',
      plan: () => ({ selected: [hostileNode], rootsVisited: 1, topScore: 1 }),
    });

    process.env.MEMRAILS_PLANNER = 'hostile_c6';
    const bundle = retrieve({ task_context: 'planner gate memory', project_id: PROJECT });

    const returned = bundle.memories.map((m) => m.memory_id);
    expect(returned).not.toContain(restricted.memory_id);
    expect(returned).not.toContain(foreign.memory_id);
    expect(returned).toContain(legit.memory_id);
    // The hostile planner is still named — accountability survives the attempt.
    expect(bundle.retrieval_trace.planner).toBe('hostile@test');
    // And the restricted suppression is explained, not silent.
    expect(bundle.omitted.some((o) => o.memory_id === restricted.memory_id && /restricted/i.test(o.reason))).toBe(
      true,
    );
  });

  it('a throwing planner never fails a retrieval: heuristic steps in, visibly', () => {
    write({ content: 'Planner fallback: subject memory.', project_id: PROJECT, tags: ['planner'], confidence: 0.9 });
    registerPlanner('broken_c6', {
      name: 'broken@test',
      plan: () => {
        throw new Error('model unavailable');
      },
    });

    process.env.MEMRAILS_PLANNER = 'broken_c6';
    const bundle = retrieve({ task_context: 'planner fallback subject memory', project_id: PROJECT });

    expect(bundle.memories.length).toBeGreaterThan(0);
    expect(bundle.retrieval_trace.planner).toBe(heuristicPlanner.name);
    expect(bundle.retrieval_trace.policy_filters_applied).toContain('planner_fallback');
  });

  it('degrades to an empty plan when even the heuristic faults (double fault)', () => {
    // A malformed index makes every planner throw; planBranches must still
    // return a plan rather than propagate — "a retrieval never fails because
    // a planner did" has no exception for the fallback itself.
    const malformed = { nodes: null, edges: [], memberships: [] } as unknown as Parameters<typeof planBranches>[1];
    const plan = planBranches('planner double fault', malformed);
    expect(plan.selected).toEqual([]);
    expect(plan.fallback).toBe(true);
    expect(plan.planner).toBe(heuristicPlanner.name);
  });
});

pgOnly('C6.4 — training rows are planner-labeled', () => {
  beforeEach(resetData);

  it('records name@version on the retrieval_training row', async () => {
    write({ content: 'Planner training label: subject memory.', project_id: PROJECT, confidence: 0.9 });
    const bundle = retrieve({ task_context: 'planner training label subject memory', project_id: PROJECT });
    await flushAuthority();

    const db = await getDb();
    const rows = await db.query<{ planner: string | null }>(
      'SELECT planner FROM retrieval_training WHERE retrieval_id = $1',
      [bundle.retrieval_id],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].planner).toBe(getPlanner().name);
  });
});
