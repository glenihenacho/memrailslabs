---
id: clm_non_goals_doc
confidence: 0.95
tags: [non-goals, scope, rejected, assumptions, rejected-assumptions]
aliases: [non-goals, rejected assumptions, what to avoid, not the target]
memory_type: constraint
index_path: /project/project_memrails/rejected_assumptions
summary: Not the target — action retrieval, credential custody, generic vector DB, raw memory dumps, or starting with five databases.
created_at: 2026-06-14
updated_at: 2026-06-14
claim: MemRails is not a generic vector database, not an action/provider-execution layer, and not a credential-custody product. Provider actions, custodial secrets, and freemium enrollment are adjacent infrastructure for later, not the core. The architecture to avoid is conversation → chunk → embed → top_k → prompt.
---

# Non-Goals

**Not core (later, if ever):** provider actions, credential execution, custodial
secrets, third-party freemium-account enrollment, generic vector search as the
product.

**Avoid:**

- starting with five databases,
- calling it a vector database,
- building provider actions before memory retrieval,
- forcing local agents to manage keys or decryption,
- **BYO rails** — making the user bring/manage Neon, Upstash, R2, or Qdrant
  (infrastructure is a MemRails-governed federation of NoSQL accounts, invisible
  to the user; see `federation.md`),
- billing by stored memories, agent count, or context tokens (meter retrieval),
- arbitrary user-facing quotas (use retrieval credits + usage pricing),
- returning raw memory dumps,
- retrieving stale memory without explanation,
- storing everything as flat chunks.

**Avoid this architecture:** `conversation → chunk → embed → top_k → prompt`.
It is not differentiated.

**Build this instead:** `memory packet → governed registry → MemoryIndex tree →
reasoning retrieval → context bundle → telemetry feedback`.
