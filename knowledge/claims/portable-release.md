---
id: clm_portable_release
confidence: 0.94
tags: [portable, conformance, release, package, sdk, cross-runtime, standard]
aliases: [portable conformance, memrails local package, conformance kit, cross-runtime round trip, v0.1 release]
index_path: /project/project_memrails/contract
memory_type: claim
summary: The reference implementation certifies the contract's Portable level — the §6 round-trip law passes across two genuinely different runtimes as separate processes (file-canonical ↔ Postgres-canonical, both directions, identical retrieves) — and ships as a standard, with the kernel packaged as @memrails/local, the conformance suite published as the certification kit, and TS + Python SDKs covering the full v0.1.1 surface.
created_at: 2026-07-06
updated_at: 2026-07-06
---

# Portable conformance & release (conversion phase C7)

- **Portable is certified, not promised (§10)**:
  `tests/conformance/cross-runtime.test.ts` runs the §6 round-trip law across
  two *separate OS processes* with different authorities — file-canonical →
  Postgres-canonical and back — and asserts identical retrieve results
  (identity, governed state, explained omissions) in both directions. Seeding
  includes a governed staleness transition, so version history and governed
  confidence survive the trip, not just content.
- **The kernel ships as `@memrails/local`** (`packages/local/`): the contract
  v0.1.1 kernel as an embeddable runtime — ESM + CJS + bundled types via
  `npm run package:local`, smoke-certified by `npm run package:verify`, which
  exercises the *built artifact* from a clean temp directory (write →
  planner-named retrieve → unmetered usage → supersession omission → §6
  round-trip → §7 projection). `MEMRAILS_KNOWLEDGE_DIR` points the corpus
  anywhere; a missing corpus is empty, not an error.
- **The conformance suite is the certification kit**:
  `tests/conformance/README.md` publishes the procedure — `npm run
  conformance` / `conformance:pg`, the test → contract-§ mapping, and the
  Baseline/Governed/Portable evidence table. Third-party backends certify by
  running the suite unchanged and taking one side of the cross-runtime trip.
- **SDKs cover the v0.1.1 surface**: TypeScript (`src/sdk/`) and Python
  (`sdk/python/`) now expose retrieve (all modes), governed writes with
  `expires_at`, the full §4 lifecycle (supersede / dispute / **restore** /
  **update_confidence** / **forget**), **feedback**, the memory map, and §6
  export — matched one-to-one to the HTTP API (restore and confidence routes
  added under `/api/memory/[id]/`).
- **No lock-in stays structural**: the package is the eject path — the same
  kernel that runs managed runs embedded, unmetered by default (§5.8), against
  markdown + JSONL the owner can read.
