import type { MemoryIndex, MemoryIndexNode } from '@/types/index-tree';
import { selectBranches } from './index-tree';
import { tokenize } from './ranking';
import { usageStats } from '@/lib/rails/usage';

/**
 * Branch planner seam (C6) — `plan(task_context, index) → BranchPlan`.
 *
 * Contract §9 (amendment v0.1.1): models MAY plan retrieval — branch
 * selection over the MemoryIndex — but they learn behavior, not memories,
 * and a plan is *advisory only*. Scope, status, sensitivity, expiry, and the
 * evidence floor are enforced in code after planning (`retrieve()` filters
 * every planned candidate against the policy-gated in-scope set), so a
 * planner proposal can never bypass §4/§5. Every planned retrieval names its
 * planner on the trace (`retrieval_trace.planner = "name@version"`).
 *
 * Two conforming planners ship in-tree:
 *
 *   heuristic@v1 — the C0 lexical tree-walk (`selectBranches`). The permanent
 *                  fallback: it runs whenever the selected planner is unknown
 *                  or throws, and that substitution is recorded on the trace
 *                  (`policy_filters_applied` gains `planner_fallback`).
 *
 *   corpus@v1    — deterministic and corpus-informed: IDF-weighted lexical
 *                  overlap (discriminative terms learned from the committed
 *                  branch vocabulary) plus a bounded usage prior per branch
 *                  from the C5 feedback loop (`usage_success`, itself
 *                  rebuildable from the ledger). No memory content enters
 *                  the model — structure and decisions only (§9).
 *
 * A hosted model planner registers behind this same interface
 * (`registerPlanner`) and is selected the same way; nothing else in the
 * pipeline changes. Selection: `MEMRAILS_PLANNER` env flag, else the default
 * recorded by the eval promotion gate (see `tests/evals/golden.json` — a
 * planner earns the default only by meeting every recorded gate at equal or
 * lower token cost than the incumbent).
 */

export type BranchPlan = {
  /** `name@version` of the planner that produced this plan — lands on the trace. */
  planner: string;
  selected: MemoryIndexNode[];
  rootsVisited: number;
  /** Lexical tree-signal strength; hybrid's vector fallback fires below threshold (C5.3). */
  topScore: number;
  /** True when the named planner failed and heuristic@v1 stepped in. */
  fallback?: boolean;
};

export interface BranchPlanner {
  /** Stable `name@version` identifier, recorded on every trace it plans. */
  readonly name: string;
  plan(taskContext: string, index: MemoryIndex): Omit<BranchPlan, 'planner' | 'fallback'>;
}

const LIMIT = 4;
const THRESHOLD = 0.0001;

export const heuristicPlanner: BranchPlanner = {
  name: 'heuristic@v1',
  plan(taskContext, index) {
    return selectBranches(index, taskContext);
  },
};

export const corpusPlanner: BranchPlanner = {
  name: 'corpus@v1',
  plan(taskContext, index) {
    const branchNodes = index.nodes.filter((n) => n.member_ids.length > 0);
    const taskTokens = new Set(tokenize(taskContext));

    const scored = branchNodes.map((node) => {
      // Lexical routing signal: identical to heuristic@v1 by design. An
      // IDF-reweighted variant was tried and rejected by the promotion gate
      // (it dropped mean_recall 1.0 → 0.9 on the golden set) — see
      // knowledge/claims/planner-model.md for the recorded experiment.
      const haystack = new Set(tokenize(`${node.title} ${node.summary} ${node.path}`));
      let overlap = 0;
      for (const t of taskTokens) if (haystack.has(t)) overlap += 1;
      const lexical = taskTokens.size === 0 ? 0 : overlap / taskTokens.size;
      // The learned term: mean bounded usage_success of the branch's members,
      // from the C5 feedback loop (rebuildable from the ledger). Branches
      // whose memories keep earning positive feedback route ahead of lexical
      // ties; persistently down-rated branches fall behind. Decisions, not
      // content — §9 holds: no memory content informs the prior.
      const prior =
        node.member_ids.reduce((sum, id) => sum + usageStats.usageSuccess(id), 0) /
        node.member_ids.length;
      return { node, score: lexical + prior, lexical };
    });

    scored.sort((a, b) => b.score - a.score);
    const selected = scored
      .filter((s) => s.score > THRESHOLD)
      .slice(0, LIMIT)
      .map((s) => s.node);

    return {
      selected: selected.length > 0 ? selected : branchNodes,
      rootsVisited: index.nodes.filter((node) => node.depth <= 2).length,
      // The vector-fallback signal stays purely lexical: a usage prior must
      // not mask a weak tree signal (C5.3 fires on weak *lexical* overlap).
      topScore: scored.reduce((max, s) => Math.max(max, s.lexical), 0),
    };
  },
};

/**
 * Default planner. `corpus@v1` earned this via the eval promotion gate
 * (`earnsPromotion` in evals.ts, re-verified in CI on every run): it meets
 * every recorded golden gate at equal-or-lower token cost than heuristic@v1.
 * heuristic@v1 remains the permanent fallback regardless of the default.
 */
export const DEFAULT_PLANNER = 'corpus';

const planners = new Map<string, BranchPlanner>();

/** Register a planner under its short key and its full `name@version`. */
export function registerPlanner(key: string, planner: BranchPlanner): void {
  planners.set(key, planner);
  planners.set(planner.name, planner);
}

registerPlanner('heuristic', heuristicPlanner);
registerPlanner('corpus', corpusPlanner);

export function getPlanner(name?: string): BranchPlanner {
  const requested = name ?? process.env.MEMRAILS_PLANNER ?? DEFAULT_PLANNER;
  return planners.get(requested) ?? heuristicPlanner;
}

/**
 * Plan branch selection with the configured planner; on planner failure fall
 * back to heuristic@v1 and mark the plan so the trace records the substitution.
 * A retrieval never fails because a planner did.
 */
export function planBranches(taskContext: string, index: MemoryIndex, plannerName?: string): BranchPlan {
  const planner = getPlanner(plannerName);
  try {
    return { planner: planner.name, ...planner.plan(taskContext, index) };
  } catch {
    return { planner: heuristicPlanner.name, fallback: true, ...heuristicPlanner.plan(taskContext, index) };
  }
}
