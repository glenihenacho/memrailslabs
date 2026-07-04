---
id: clm_contract_v0_1
confidence: 0.95
tags: [contract, spec, conformance, governed, portability, standard]
aliases: [memrails contract, v0.1 contract, conformance spec, memory contract]
memory_type: constraint
index_path: /project/project_memrails/contract
summary: The normative MemRails v0.1 contract — record model, governance invariants, retrieval guarantees, export/import portability, the memrails.md projection, and the Baseline/Governed/Portable conformance levels.
created_at: 2026-07-04
updated_at: 2026-07-04
---

# MemRails Contract v0.1

> Normative specification. The words **MUST**, **MUST NOT**, **SHOULD**, and
> **MAY** are used as in RFC 2119. Every MUST in this document is enforced by
> the conformance suite in `tests/conformance/`; a change that cannot keep that
> suite green is a contract change and goes through a spec revision, not a code
> sneak.

## §1 Purpose & scope

MemRails is memory infrastructure for locally inferred agents. The contract
governs one primitive:

```ts
memory.retrieve(task_context) // → ContextBundle
```

The contract specifies observable behavior only — what a conforming runtime
returns, refuses, records, exports, and projects. It does not specify storage.
A file-canonical runtime (markdown corpus + JSON overlay + JSONL stores) and a
PostgreSQL-canonical runtime are equally conforming if the suite passes; that
is the point.

## §2 Terms

| Term | Meaning |
|---|---|
| **Record** | One governed memory: content + scope + status + sensitivity + provenance (`MemoryRecord`, `src/types/governed.ts`). |
| **Registry** | The authoritative set of records after governance is applied. |
| **Overlay / authority** | Mutable governance state (status transitions, confidence overrides, version history) applied over canonical content. |
| **Bundle** | The output of `memory.retrieve()`: scored memories + omissions + trace (`ContextBundle`, `src/types/bundle.ts`). |
| **Scope** | The `owner → project → agent` triple every record and every retrieval carries. |
| **Ledger** | Append-only event log of every governance change and retrieval. |
| **Tombstone** | A record removed from retrieval on request, retained as id + event history only. |

## §3 Memory record (normative)

A record MUST carry: `memory_id`, `scope{owner_id, project_id, agent_id?}`,
`memory_type`, `status`, `confidence ∈ [0,1]`, `sensitivity`, `content`,
`summary`, `tags`, `source_refs`, `contradictions`, `index_path`,
`current_version`, `created_at`, `updated_at`.

- `status` ∈ `active | superseded | disputed | tombstoned`.
- `sensitivity` ∈ `normal | sensitive | restricted`.
- Content is canonical and never silently mutated: governance changes land in
  the overlay/authority as versioned transitions, not as content rewrites.

## §4 Governance invariants

1. **Writes are governed.** `memory.write()` MUST validate, classify, dedupe,
   and contradiction-check before creating a record. It MUST NOT rewrite
   curated canonical content.
2. **No self-supersession.** A record MUST NOT supersede itself; a conforming
   runtime rejects `supersede(id, {new_memory_id: id})`.
3. **Supersession preserves the chain.** The superseded record keeps its
   content and version history, gains `superseded_by`, and leaves active
   retrieval. It MUST surface in `omitted[]` with a reason when it would
   otherwise have been retrieved.
4. **Dispute is reversible doubt.** A disputed record drops confidence, leaves
   default retrieval, and returns only when the caller explicitly opts in
   (`include_disputed`).
5. **Tombstone excludes absolutely.** A tombstoned record MUST NOT appear in
   any bundle's `memories[]`, regardless of flags. It MAY appear in
   `omitted[]` with a reason.
6. **Every transition is versioned.** Supersede, dispute, restore, tombstone,
   and confidence changes append a version entry and a ledger event.

## §5 Retrieval guarantees

Pipeline (normative order): scope resolution → policy filter → index/tree
branch selection → candidate gather → transparent ranking → token-budgeted
assembly → telemetry.

1. **Trace on every bundle.** Every bundle MUST carry a `retrieval_trace` with
   the mode, branches selected, policy filters applied, and candidate count —
   in every mode, not only `debug`.
2. **Omissions are explained.** Every entry in `omitted[]` MUST carry a
   non-empty human-readable `reason` (superseded, disputed, restricted,
   expired, tombstoned, token budget). Silent omission is non-conforming.
3. **Selection is explained.** Every entry in `memories[]` MUST carry a
   non-empty `reason_selected` and a numeric score.
4. **Policy precedes ranking.** Scope, status, sensitivity, and expiry gates
   run before anything is scored. `restricted` records never leave the
   runtime through retrieval.
5. **Evidence floor.** Synthesis (packet building) MUST filter candidates at
   the evidence floor, default **0.75** confidence. Below-floor material is
   excluded or explicitly flagged, never silently blended.
6. **Uncertainty is labeled.** When all cited evidence sits below 0.85
   confidence, synthesized output MUST carry an explicit `[uncertain]` label.
   A runtime MUST NOT synthesize beyond available evidence without labeling.
7. **Budget is honored.** `tokens_returned ≤ token_budget`, with one carve-out:
   the top-ranked memory is always returned even when it alone exceeds the
   budget (a retrieval never comes back empty because the best memory is
   large). All other overflow lands in `omitted[]` with a budget reason.
8. **Retrieval is metered.** One successful retrieve = one billable retrieval,
   surfaced as `usage` on the bundle. An unmetered (self-host) runtime reports
   zero usage rather than fabricating charges.

## §6 Record export / import (portability)

A conforming runtime MUST export and import its records such that a second
conforming runtime reproduces retrieval behavior.

**Export** — JSONL, one record per line, overlay applied (the exported record
reflects governed state, not raw canonical state):

- `restricted` records are **never** exported.
- `sensitive` records are exported only when explicitly requested
  (`include_sensitive`).
- Tombstoned records are exported as **id + event history only** — no content,
  no summary.
- Each line carries a format marker (`export: memrails.record.v0_1` or
  `memrails.tombstone.v0_1`) and the record's version history.

**Import** MUST:

- preserve `memory_id`, `source_refs`, version history, and `status`;
- be idempotent — re-importing an already-present record reconciles governance
  state instead of duplicating;
- honor tombstones — an imported tombstone excludes the record from retrieval
  in the target runtime;
- re-run the local evidence floor and report records below it rather than
  silently accepting or rejecting them.

**Round-trip law:** export → wipe → import yields identical retrieve results
with intact provenance — everything a caller can *receive* is identical, and
identity, `source_refs`, version history, status, and supersession pointers
survive the trip. Audit omission lines for content that never traveled
(restricted records, tombstone bodies) need not reappear in the target
runtime. This is the Portable conformance test.

## §7 The `memrails.md` projection

A conforming runtime MUST be able to project its governed store into a single
derived markdown file:

- The file starts with a `DERIVED ARTIFACT` header naming the generator; it is
  regenerable at any time and MUST NOT be treated as a write surface.
- Structure comes from the memory map (index tree); content comes from a
  governed, scoped read — the same policy gates as retrieval apply.
- Sections group records by `memory_type` (decisions, constraints,
  preferences, corrections, claims, notes, …).
- Records below the evidence floor (§5.5) are excluded; `restricted` records
  are excluded; `sensitive` records are excluded unless explicitly requested;
  only `active` records project.
- The file ends with a trace footer: scope, policy filters applied, branch
  paths, included/omitted counts, floor, and generation time.

## §8 Ledger & audit

Every governance transition (§4.6) and every retrieval MUST append a ledger
event. Events are exportable as JSONL. A user MUST be able to reconcile billed
retrievals against logged retrievals, and to replay why any bundle contained
what it contained (trace + omissions + ledger).

## §9 Model involvement

Models MAY plan retrieval (branch selection, budget allocation). They learn
**behavior, not memories**: no memory content in training targets — only
structure and decisions. Floor, status, scope, and sensitivity gates are
enforced in code *after* planning; a planner proposal can never bypass §4/§5.
When a model plans a retrieval, the trace MUST name it (`planner:
model@version` — spec amendment v0.1.1).

## §10 Kernel & conformance levels

The kernel (`src/types`, `src/lib/memory`, `src/lib/ledger`, `src/lib/rails`)
implements this contract and MUST NOT depend on the product shell (app,
billing, accounts, auth, pricing, MCP transport). Enforced by
`npm run core:check`.

| Level | Requirement |
|---|---|
| **Baseline** | §3 record model + §5.1–5.4 retrieval guarantees. |
| **Governed** | Baseline + §4 governance invariants + §5.5–5.8 + §6 export/import + §7 projection + §8 ledger. |
| **Portable** | Governed + the §6 round-trip law passing across two genuinely different runtimes. |

A runtime claims a level only with a passing conformance suite, not a promise.
