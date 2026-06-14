---
id: clm_pricing
confidence: 0.9
tags: [pricing, billing, packets]
aliases: [pricing model, packet billing, orchestration cost]
index_path: /project/project_memrails/pricing
memory_type: claim
created_at: 2026-05-25
updated_at: 2026-05-25
claim: MemRails is priced by memory retrieval — one successful memory.retrieve() is one billable unit, default $0.002 ($2 per 1,000), with no seat fees and no arbitrary quotas. The legacy packet orchestration price ($5 per 10,000 packets) applies only to the packet synthesis path. See billing-model.md.
---

# Pricing

**Primary (the product):** metered by retrieval — see `billing-model.md`.

- One successful `memory.retrieve()` = one billable retrieval.
- Default `$0.002` / retrieval (`$2` per 1,000).
- Free tier = retrieval credits, not caps. No seat fees, no arbitrary quotas.
- Writes are cheap; context tokens are the model provider's charge, not ours.

**Legacy (packet synthesis path):**

- One packet = one completed evidence-graded synthesis (~500 output tokens).
- Orchestration: $5 / 10,000 packets.
- BYO model: pay the provider directly. Managed Compress-v1: MemRails serves it.
