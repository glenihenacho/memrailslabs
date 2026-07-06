---
id: clm_retrieval_quality
confidence: 0.93
tags: [telemetry, quality, feedback, usage-success, staleness, vector, evals]
aliases: [usage success, telemetry loop, staleness job, vector fallback, evals harness, quality gate]
index_path: /project/project_memrails/retrieval_architecture
memory_type: claim
summary: The retrieval quality loop is closed — feedback fans out to bundle memories and feeds usage_success in the scorer, staleness re-verifies past expires_at through evented re-scores, the vector fallback fires only in hybrid mode on weak tree signal and is always trace-recorded, and every retrieval lands in the training corpus that the evals harness gates C6 against.
created_at: 2026-07-06
updated_at: 2026-07-06
---

# Retrieval quality (conversion phase C5)

- **usage_success is live**: FEEDBACK_RECORDED (v2) fans retrieval-level
  ratings out to the bundle's memory ids; the usage projection
  (`rails/usage.ts`, rebuildable from the ledger) feeds a bounded ±0.15,
  Laplace-smoothed term into the transparent scorer.
- **Staleness is governed**: `npm run memory:staleness` re-verifies records
  past `expires_at` with an evented, versioned confidence downgrade
  (`updateConfidence`, changed_by `staleness_job`) — never a silent decay.
- **Vector fallback, never primary**: fires only in `hybrid` mode when the
  tree signal is weak (top branch overlap < 0.15), always recorded in the
  trace (`policy_filters_applied` gains `vector_fallback`). Deterministic
  hashed-BoW embedding locally; pgvector slots behind the same interface on
  a pg-wire Postgres. The non-goal stands: no chunk→embed→top_k as the path.
- **Every retrieval is training data**: `retrieval_training` stores hashed
  task context, branch plan, full score breakdowns, inclusion/omission, the
  fallback flag, and feedback outcomes — structure and decisions, never
  memory content (contract §9).
- **The evals harness gates C6**: fixed golden query set
  (`tests/evals/golden.json`) with recorded baseline (mean recall 1.0,
  top-hit 0.8, zero floor violations, median 547.5 tokens). Model-planned
  retrieval must meet these gates at equal or lower token cost before any
  default flip; the heuristic tree is the permanent fallback.
