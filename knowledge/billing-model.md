---
id: clm_billing_model_doc
confidence: 0.95
tags: [billing, pricing, retrieval, metering, credits, commercial, pricing]
aliases: [billing model, pricing model, metered retrieval, retrieval pricing, per retrieval]
memory_type: decision
index_path: /project/project_memrails/pricing
summary: MemRails meters by memory retrieval — one successful memory.retrieve() is one billable unit ($0.002 / $2 per 1,000). Writes are not billed, context tokens are not billed.
created_at: 2026-06-14
updated_at: 2026-06-14
claim: MemRails is priced by memory retrieval. One successful memory.retrieve() equals one billable retrieval, default $0.002 ($2 per 1,000). Writes are not billed because they create future retrieval value. Context tokens are not billed (the model provider already charges those). There are no arbitrary user-facing quotas — usage-based pricing absorbs scale, with hidden infrastructure guardrails only for abuse and stability.
---

# Billing Model — metered by retrieval

**1 successful `memory.retrieve()` = 1 billable retrieval.** Default price
`$0.002` per retrieval (`$2` / 1,000). The unit is the value: the user pays
only when memory is actually used during inference.

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
