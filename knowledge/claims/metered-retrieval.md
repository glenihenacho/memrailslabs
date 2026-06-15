---
id: clm_metered_retrieval
confidence: 0.97
tags: [billing, retrieval, metering, primitive, commercial, pricing]
aliases: [metered retrieval, billable retrieval, billing unit, retrieval unit]
memory_type: decision
index_path: /project/project_memrails/pricing
summary: The commercial primitive is the metered retrieval — one successful memory.retrieve() is one billable unit.
created_at: 2026-06-14
updated_at: 2026-06-14
claim: The commercial and technical primitive are the same — memory.retrieve(). One successful retrieval is one billable unit. A billable retrieval covers scope check, policy filtering, MemoryIndex traversal, candidate ranking, context bundle construction, and telemetry. Users bring local inference and model tokens; MemRails provides hosted memory and metered retrieval.
---

# Metered Retrieval

The product promise, short: **agents infer locally, MemRails remembers
centrally, you pay only when memory is retrieved.**

A billable retrieval bundles scope → policy → MemoryIndex traversal → ranking →
context bundle → telemetry. The bundle returns minimal `usage`
(`billable_retrievals: 1`); billing and internal cost events are logged
server-side. Writes are cheap; tokens are the model provider's charge, not ours.
