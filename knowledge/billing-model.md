---
id: clm_billing_model_doc
confidence: 0.95
tags: [billing, pricing, retrieval, metering, credits, commercial, pricing]
aliases: [billing model, pricing model, metered retrieval, retrieval pricing, per retrieval]
memory_type: decision
index_path: /project/project_memrails/pricing
summary: MemRails has one fee — the orchestration/retrieval unit, separate from inference. One non-cache-hit memory.retrieve() is one billable unit ($0.00062 / $0.62 per 1,000), regardless of which layer resolves it. Cache hits, writes, and context tokens are not billed.
created_at: 2026-06-14
updated_at: 2026-06-15
claim: MemRails has a single fee — the orchestration/retrieval unit, charged separately from model inference. One non-cache-hit memory.retrieve() equals one billable unit, default $0.00062 ($0.62 per 1,000), regardless of which retrieval layer resolves it. Cache hits are free. Writes are not billed because they create future retrieval value. Context tokens are not billed (the model provider already charges those). There is no separate packet/synthesis fee. There are no arbitrary user-facing quotas — usage-based pricing absorbs scale, with hidden infrastructure guardrails only for abuse and stability.
---

# Billing Model — one fee, metered by retrieval

There is a **single MemRails fee**: the orchestration/retrieval unit, charged
**separately from model inference**. **1 non-cache-hit `memory.retrieve()` = 1
billable unit**, regardless of which layer (L1–L5) resolved it. Default price
`$0.00062` per unit (`$0.62` / 1,000). **Cache hits are free.** The unit is the
value: the user pays only when memory is actually used during inference. There
is no separate packet/synthesis fee — synthesis is part of the same retrieval.

## Why retrieval, not the alternatives

| Basis | Problem |
|---|---|
| stored memories | punishes remembering |
| agent / project count | arbitrary |
| context tokens | duplicative — model provider already charges tokens |
| database usage | too infrastructure-exposed |
| **retrieval count** | **maps to actual agent value** |

## Multipliers (off in v1)

`standard 1.0 · deep 3.0 · debug 1.5 · bulk ×N`. v1 keeps it simple: every
retrieval is 1.0 unit (`SIMPLE_V1`). Multipliers can flip on without changing
the API or the billing primitive.

## No arbitrary quotas

No memory caps, agent caps, or project caps. Free tier ships **retrieval
credits** (e.g. 2,500), not limits. Hidden guardrails exist only for abuse,
runaway loops, payment failure, and stability — "elastic usage-based memory
retrieval," not "unlimited."

## Tiers

`Free` (credits) → `Usage` (pay per retrieval) → `Team` (shared billing +
audit) → `Enterprise` (dedicated rails + compliance). The unit stays retrieval.

## Internal cost accounting

Pricing is per-retrieval, but MemRails tracks internal cost per retrieval (sql,
cache, storage, index, reasoning, telemetry) so margins are managed without
exposing infrastructure. The user sees `1 retrieval`; MemRails sees the
economics.
