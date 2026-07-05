---
id: clm_contract_v0_1_pointer
confidence: 0.95
tags: [contract, spec, conformance, standard]
aliases: [contract v0.1, normative spec, conformance levels, portable conformance]
index_path: /project/project_memrails/contract
memory_type: claim
summary: The v0.1 contract in knowledge/memrails-contract-v0.1.md is the normative spec; conformance levels (Baseline/Governed/Portable) are claimed only with a passing suite in tests/conformance/.
created_at: 2026-07-04
updated_at: 2026-07-04
claim: The MemRails v0.1 contract (knowledge/memrails-contract-v0.1.md) is the normative spec — record model, governance invariants, retrieval guarantees, export/import portability, the memrails.md projection — and a runtime claims Baseline, Governed, or Portable conformance only with a passing suite in tests/conformance/.
---

# Contract v0.1 — normative spec pointer

The canonical spec lives at `knowledge/memrails-contract-v0.1.md`. Key facts:

- Every MUST in the spec maps to a test in `tests/conformance/`.
- Conformance levels: **Baseline** (record model + retrieval guarantees),
  **Governed** (+ governance invariants, export/import, `memrails.md`
  projection, ledger), **Portable** (+ cross-runtime round-trip law).
- A change that cannot keep the conformance suite green is a contract change
  and goes through a spec revision, never a code sneak.
- The kernel implementing the contract must not depend on the product shell —
  enforced by `npm run core:check`.
