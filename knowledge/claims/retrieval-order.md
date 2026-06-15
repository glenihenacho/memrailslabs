---
id: clm_retrieval_order
confidence: 0.95
tags: [retrieval, order, grep, key, semantic, evidence, compress]
aliases: [retrieval order, layer order, query path]
index_path: /project/project_memrails/retrieval_architecture
memory_type: claim
created_at: 2026-05-25
updated_at: 2026-05-25
claim: Retrieval order is grep → key → semantic → evidence → compress. The orchestrator runs cheap filters first and only falls through to L5 compression when lower tiers fail to resolve or when the intent requires synthesis.
---

# Retrieval Order

```yaml
retrieval:
  - grep      # L1
  - key       # L2
  - semantic  # L3
  - evidence  # L4
  - compress  # L5
```

L5 is a fallback and a synthesis surface — never the default. Every layer
records latency and the claim IDs it considered, so the Console can show
exactly why the packet was generated.
