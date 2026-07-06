---
id: clm_planner_model
confidence: 0.93
tags: [planner, memory-index, model, trace, evals, promotion, fallback]
aliases: [branch planner, planner seam, corpus planner, planner promotion, model-planned retrieval]
index_path: /project/project_memrails/retrieval_architecture
memory_type: claim
summary: Branch selection goes through the C6 planner seam — plan(task_context, index) → BranchPlan — where planners are advisory and named on every trace, policy and floor gates run in code after planning, heuristic@v1 is the permanent fallback, and corpus@v1 holds the default only because it earned it through the recorded eval promotion gate at equal token cost.
created_at: 2026-07-06
updated_at: 2026-07-06
---

# MemoryIndex planner model (conversion phase C6)

- **The seam**: `plan(task_context, index) → BranchPlan` in
  `src/lib/memory/planner.ts`. `retrieve()` no longer calls the tree-walk
  directly; the configured planner proposes branches and code disposes. A
  hosted model planner registers behind the same interface
  (`registerPlanner`) — nothing else in the pipeline changes.
- **Plans are advisory (contract §9)**: scope, status, sensitivity, expiry,
  and the evidence floor are enforced in code *after* planning — every
  planned candidate is re-filtered against the policy-gated in-scope set, so
  a planner proposal structurally cannot leak restricted or out-of-scope
  memory. Proven by the C6 conformance tests.
- **Every plan is named (amendment v0.1.1)**: `retrieval_trace.planner`
  carries `name@version` on every retrieval. Planner failure never fails a
  retrieval: heuristic@v1 steps in and the substitution is visible
  (`policy_filters_applied` gains `planner_fallback`).
- **Two conforming planners ship**: `heuristic@v1` (the C0 lexical
  tree-walk, permanent fallback) and `corpus@v1` (identical lexical routing
  plus a learned per-branch usage prior from the C5 feedback loop — bounded
  usage_success, rebuildable from the ledger; behavior, not memories).
- **The default is earned, not declared**: `corpus@v1` holds the default
  because the promotion gate (`earnsPromotion` in evals.ts) records it
  meeting every golden gate at equal token cost, and CI re-verifies the
  promotion on every eval run. An IDF-reweighted variant was tried first and
  **rejected by this gate** (mean_recall 1.0 → 0.9): the gate exists to say
  no, and it did.
- **Selection flag**: `MEMRAILS_PLANNER=heuristic|corpus|<registered>` per
  run; unknown names resolve to the heuristic fallback.
