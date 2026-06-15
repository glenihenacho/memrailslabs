---
id: clm_pricing
confidence: 0.9
tags: [pricing, billing, packets]
aliases: [pricing model, retrieval fee, orchestration cost]
index_path: /project/project_memrails/pricing
memory_type: claim
created_at: 2026-05-25
updated_at: 2026-06-15
claim: MemRails has one fee — the orchestration/retrieval unit, charged separately from model inference. One non-cache-hit memory.retrieve() is one billable unit, default $0.00062 ($0.62 per 1,000), regardless of which layer resolves it. Cache hits are free. No seat fees, no arbitrary quotas, no separate packet/synthesis fee. See billing-model.md.
---

# Pricing — one fee

A **single fee**: the orchestration/retrieval unit, separate from model
inference — see `billing-model.md`.

- One non-cache-hit `memory.retrieve()` = one billable unit, regardless of which
  layer (L1–L5) resolved it.
- Default `$0.00062` / unit (`$0.62` per 1,000). Cache hits are free.
- This fee is **orchestration/retrieval only** — model inference is separate.
  BYO model: pay the provider directly. Managed Compress-v1: MemRails serves it.
- No separate packet/synthesis fee; synthesis is part of the same retrieval.
- Free tier = retrieval credits, not caps. No seat fees, no arbitrary quotas.
- Writes are free; context tokens are the model provider's charge, not ours.
