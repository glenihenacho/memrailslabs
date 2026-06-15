---
id: clm_architecture
confidence: 0.95
tags: [architecture, retrieval, stack]
aliases: [retrieval stack, l1-l5, layers, retrieval order]
index_path: /project/project_memrails/retrieval_architecture
memory_type: note
created_at: 2026-05-25
updated_at: 2026-05-25
claim: The MemRails retrieval stack runs L1 grep, L2 key lookup, L3 semantic, L4 evidence filter, L5 compression in that order — cheap filters before expensive synthesis, with L5 reserved as a last-resort synthesis layer.
---

# Architecture — Retrieval Stack

| Layer | Purpose | Cost |
|---|---|---|
| L1 — Grep | Literal substring retrieval | nil |
| L2 — Key | Frontmatter / alias / tag lookup | nil |
| L3 — Semantic | Approximate meaning match (embeddings, when available) | low |
| L4 — Evidence | Confidence + contradiction filter | nil |
| L5 — Compress | Synthesis into a ≤600-token packet | high |

L5 only fires when lower layers fail to resolve, or when the intent (e.g.
`summarize`, `compare`) requires synthesis. Every packet carries provenance,
input hash, output hash, and a confidence score.

## Relationship to governed retrieval

This L1–L5 stack is the **synthesis surface**. The product's core primitive is
`memory.retrieve()` (see `governed-retrieval.md`), which runs scope → policy →
MemoryIndex tree reasoning → ranking → context bundle. When a caller asks for a
single synthesized answer (`include_packet`), the top bundle memories are
compressed through L5 into a packet — so the packet contract survives the
reconcile while governed retrieval, not compression, leads.
