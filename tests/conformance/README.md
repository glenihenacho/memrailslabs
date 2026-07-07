# MemRails Conformance Kit (contract v0.1.1)

This directory is the **certification artifact** for the MemRails memory
contract (`knowledge/memrails-contract-v0.1.md`). A runtime claims a
conformance level **only with a passing suite, not a promise** (§10). The
suite is storage-agnostic by design: the same tests certify the
file-canonical backend, the Postgres-canonical backend, and any third-party
backend that implements the kernel seams.

## Running

```bash
npm run conformance       # against the file-canonical authority
npm run conformance:pg    # against the embedded Postgres authority
```

Both must pass **unchanged** — a change that cannot keep this suite green is
a contract change and goes through a spec revision, not a code sneak.

## Test → contract mapping

| File | Certifies |
|---|---|
| `contract.test.ts` | §3 record model, §4 governance invariants (no self-supersession, supersession chain, reversible dispute, absolute tombstone, versioned transitions), §5 retrieval guarantees (trace on every bundle, explained omissions/selections, policy before ranking, evidence floor, `[uncertain]` labeling, budget with the §5.7 top-memory carve-out, metering) |
| `portability.test.ts` | §6 export/import — format markers, restricted never exported, sensitive gated, tombstones as id+history, idempotent re-import, the in-process round-trip law |
| `projection.test.ts` | §7 `memrails.md` — derived-artifact header, governed+scoped content, floor/sensitivity exclusions, trace footer |
| `cross-runtime.test.ts` | **§10 Portable** — the §6 round-trip law across two genuinely different runtimes: separate OS processes, one file-canonical and one Postgres-canonical, in both directions, with identical retrieve results |

Ledger (§8) and planner accountability (§9 / amendment v0.1.1) are certified
by the adjacent suites the full matrix runs: `tests/ledger/` (event spine,
transactional governance commits, rebuild-from-ledger), `tests/rails/`
(projections rebuild identically from the ledger), `tests/quality/`
(planner naming, advisory-plan enforcement, fallback visibility) and
`tests/evals/` (recorded quality gates + the planner promotion law).

## Conformance levels (§10)

| Level | Requirement | Suite evidence |
|---|---|---|
| **Baseline** | §3 + §5.1–5.4 | `contract.test.ts` |
| **Governed** | Baseline + §4 + §5.5–5.8 + §6 + §7 + §8 | `contract` + `portability` + `projection` + `tests/ledger` |
| **Portable** | Governed + §6 round-trip across two different runtimes | `cross-runtime.test.ts` |

The reference implementation certifies **Portable**: `npm run test` (file),
`npm run test:pg` (Postgres), and `cross-runtime.test.ts` all green.

## Certifying a new backend

1. Implement the kernel seams — the authority dispatch used by
   `src/lib/memory/{store,registry,governance}.ts` and `src/lib/ledger/*`
   (see the Postgres authority under `src/lib/memory/authority/` as the
   worked example).
2. Wire your backend behind `MEMRAILS_AUTHORITY` (or your own selector) and
   run this suite against it, unchanged.
3. For **Portable**: run `cross-runtime.test.ts` with your backend as one
   side of the trip — export from the reference runtime into yours and back,
   identical retrieves both ways.
4. State the level you pass. Nothing else counts as a claim.

## Ground rules

- Tests write only to `MEMRAILS_DATA_DIR` (the vitest config isolates
  `.tmp-test-data`) and reset through `helpers.ts` — a backend must survive
  `resetData()` between cases.
- The canonical corpus is read-only for the suite; a missing
  `MEMRAILS_KNOWLEDGE_DIR` is an empty corpus, not an error.
- Determinism is part of the contract surface: same store + same query ⇒
  same bundle (modulo ids, timestamps, latency).
