---
id: clm_memory_retrieve
confidence: 0.98
tags: [retrieve, primitive, governed, scope, architecture, product-scope]
aliases: [memory.retrieve, memory retrieve, core primitive, retrieve primitive]
memory_type: decision
index_path: /project/project_memrails/product_scope
summary: The core MemRails primitive is memory.retrieve() — governed memory retrieval for locally inferred agents, not action retrieval.
created_at: 2026-06-14
updated_at: 2026-06-14
claim: MemRails is cloud-hosted memory infrastructure for locally inferred agents. The core primitive is memory.retrieve(task_context), which returns a governed, scoped, explainable context bundle. Retrieving provider actions, credentials, or running a generic vector database are explicitly not the target.
---

# Memory Retrieve — the core primitive

The local agent's experience is: **ask for memory, receive useful context,
infer locally.** No key handling, no decryption workflow, no local vector DB,
no database management.

`memory.retrieve()` returns governed memory selected for:

- relevance, authority, scope, freshness, provenance, usefulness, confidence,
  and context fitness — not raw vector similarity.

The agent retrieves memory; it never decrypts memory. Policy filtering happens
server-side before any memory is returned.
