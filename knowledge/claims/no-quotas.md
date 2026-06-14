---
id: clm_no_quotas
confidence: 0.93
tags: [quotas, pricing, credits, limits, product-promise, pricing]
aliases: [no quotas, no caps, retrieval credits, elastic usage]
memory_type: constraint
index_path: /project/project_memrails/pricing
summary: No arbitrary user-facing quotas. Free tier ships retrieval credits, not caps; guardrails are for abuse only.
created_at: 2026-06-14
updated_at: 2026-06-14
claim: MemRails has no arbitrary user-facing quotas — no memory caps, agent caps, or project caps. The free tier is retrieval credits, not limits. Hidden infrastructure guardrails exist only for abuse prevention, runaway loops, payment failure, and stability. The correct phrasing is "elastic usage-based memory retrieval," never "unlimited with no rate limits."
---

# No Arbitrary Quotas

Usage-based pricing absorbs scale, so commercial limits are unnecessary:

- Free → included **retrieval credits** (e.g. 2,500).
- Paid → pay per retrieval.
- Heavy users pay naturally because they retrieve more.

Guardrails (abuse, runaway loops, payment failure, DDoS, fraud, stability) are
infrastructure protections, **not** commercial quotas. Storage is priced into
retrieval economics in v1; a dormant-archive fee is a later option, kept out of
the v1 model to keep it pure.
