---
id: clm_temporal_retrieval
confidence: 0.9
tags: [temporal, timeline, completeness, as-of, system-time, retrieval-architecture]
aliases: [temporal retrieval, timeline, date range, as-of, window query, completeness contract]
memory_type: decision
index_path: /project/project_memrails/retrieval_architecture
summary: Timeline is a completeness-contract path — it returns ALL in-scope memory for a window (or the active set as-of an instant), organized by topic and ordered by system time, selecting/organizing canonical records without ranking, pruning, or synthesis.
created_at: 2026-06-19
updated_at: 2026-06-19
claim: Temporal retrieval is a distinct completeness contract from memory.retrieve(). memory.retrieve() is relevance-ranked, token-budgeted, and lossy; the timeline returns ALL of the caller's in-scope memory in a window (any status — the full history of the segment), or the active set reconstructed as-of an instant from each record's system-time version chain. The compiler only selects and organizes existing canonical records — it never ranks, prunes to a budget, or synthesizes content. Forgotten (tombstoned) records remain visible in the timeline for audit but their body is redacted.
---

# Temporal Retrieval — the completeness contract

`memory.retrieve()` answers "what is *relevant* to this task" — it ranks,
token-budgets, and drops the rest. That is the wrong contract for "what
happened in this segment of time," which needs **completeness**, not relevance.
So temporal retrieval is its own path: `POST /api/memory/timeline`
(`compileTimeline`).

## Two modes

- **`window`** (`from`/`to`) — every record created in the window, **any
  status**, so the full historical record of the segment is returned. No
  relevance prune, no token budget.
- **`as_of`** (instant) — the live active set reconstructed at that time, by
  replaying each record's lifecycle version chain up to the instant
  (`statusAsOf`). High-fidelity system time: creation and every transition
  carry their own timestamp.

## Discipline

- **Select & organize, never generate.** The compiler is a deterministic
  projection over canonical records (grouped by `index_path`, ordered by system
  time). No LLM synthesis; provenance is preserved.
- **Completeness means all.** `total` is every match, not a top-K.
- **Forget is audit-safe.** Tombstoned records stay in the timeline with a
  `[forgotten]` body so the audit trail survives without exposing the content.

## Made-to-order index (prompt + time)

The layer on top of completeness: `compileView` (`POST /api/memory/compile`)
takes the completeness slice and builds a **fresh index over only that
window**, organized around a prompt. Sections are ordered by relevance to the
question and entries within them likewise — but **nothing is dropped**:
relevance orders, it does not filter (`total` = every in-window record;
`total_relevant` is how many matched). Relevance is a deterministic lexical
projection over canonical records — select & organize, never generation.

So: `prompt + time → a made-to-order index over the complete time slice`. This
reconciles the relevance/completeness tension — you get the question's framing
*and* the full segment.

## Honest limits

- Window is keyed on `created_at` (system time). Full **bitemporal** valid-time
  (when a fact was *true* vs. when it was *recorded*) is a further extension.
- Relevance is lexical (token overlap). A semantic/embedding pass or an
  LLM-structured ToC would sharpen organization — but only over labeled
  evidence, never inventing content.

Code: `src/lib/memory/temporal.ts` (completeness + `selectScoped` + `statusAsOf`),
`src/lib/memory/compile.ts` (prompt-compiled view),
`src/app/api/memory/{timeline,compile}/route.ts`.
Tests: `tests/memory/{timeline,compile}.test.ts`.
