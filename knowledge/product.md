---
id: clm_product
confidence: 0.95
tags: [product, positioning, primitives]
aliases: [product truth, positioning, one-line]
index_path: /project/project_memrails/product_scope
memory_type: decision
created_at: 2026-05-25
updated_at: 2026-05-25
claim: MemRails turns messy knowledge into compact, evidence-graded packets that agents can query, inspect, stream, and pay for. The core thesis is that agents do not need more raw context; they need denser, inspectable memory packets.
---

# Product Truth

## Locked definition

MemRails is **cloud-hosted memory infrastructure for locally inferred agents**.
The core primitive is `memory.retrieve()` — governed memory retrieval, not
action retrieval. The agent asks for memory, receives a governed context
bundle, and infers locally: no key handling, no decryption, no local vector DB,
no database management.

## One-liner

MemRails turns messy knowledge into compact, evidence-graded packets that
agents can query, inspect, stream, and pay for.

## Core thesis

Agents do not need more raw context. They need denser, inspectable memory
packets.

## Primitives

- **Memory** — canonical markdown-backed knowledge.
- **Packet** — billable compressed answer unit.
- **Console** — observability layer.
- **MCP** — agent tool surface.
- **Compress-v1** — L5 synthesis layer.

> Harness is not a current core primitive — dropped from the product-primitive
> narrative while the exact core product is being dialed in. The in-loop runtime
> still exists as a delivery surface, not a headline primitive.
