/**
 * Branch planner contract (C6, contract §9 / amendment v0.1.1).
 *
 * A planner proposes MemoryIndex branches for a retrieval; code disposes —
 * policy and floor gates run after planning, so a plan can never widen
 * scope. Every plan is named on the retrieval trace, and any fallback
 * substitution is trace-visible. Implementations live in
 * `src/lib/memory/planner.ts`.
 */

import type { MemoryIndex, MemoryIndexNode } from './index-tree';

export type BranchPlan = {
  /** `name@version` of the planner that produced this plan — lands on the trace. */
  planner: string;
  selected: MemoryIndexNode[];
  rootsVisited: number;
  /** Lexical tree-signal strength; hybrid's vector fallback fires below threshold (C5.3). */
  topScore: number;
  /** True when the named planner was substituted in (unknown name or planner failure). */
  fallback?: boolean;
};

export interface BranchPlanner {
  /** Stable `name@version` identifier, recorded on every trace it plans. */
  readonly name: string;
  plan(taskContext: string, index: MemoryIndex): Omit<BranchPlan, 'planner' | 'fallback'>;
}
