---
id: clm_index
confidence: 1.0
tags: [index, overview]
aliases: [knowledge index, repo memory]
created_at: 2026-05-25
updated_at: 2026-06-15
---

# Knowledge Index

This directory is the canonical, Git-versioned memory for MemRails. Every
claim lives in `knowledge/claims/*.md` with frontmatter that the governed
registry, MemoryIndex tree, and evidence filtering read directly.

MemRails is **cloud-hosted memory infrastructure for locally inferred agents**.
The core primitive is `memory.retrieve()`, which returns a governed,
scoped, explainable **context bundle**. The packet/L1–L5 path is the synthesis
surface beneath it (see `architecture.md`).

- `governed-retrieval.md` — `memory.retrieve()` pipeline, modes, ranking.
- `billing-model.md` — metered-by-retrieval commercial model.
- `federation.md` — three planes: SQL government · MemoryIndex protocol · federated NoSQL infrastructure.
- `stack.md` — canonical rail map (Postgres + MemoryIndex + Redis + R2; global vs per-owner).
- `data-model.md` — registry / index / telemetry schema (Postgres ↔ MVP).
- `roadmap.md` — phased build plan.
- `non-goals.md` — what MemRails is deliberately not.
- `product.md` — primitives, positioning, wedge.
- `architecture.md` — packet/L1 → L5 synthesis stack.
- `pricing.md` — retrieval-based billing (legacy packet price retained).
- `claims/` — atomic, confidence-graded claims (memory-retrieve, context-bundle,
  governed-scope, memory-index, memory-supersession, packet-contract, …).
