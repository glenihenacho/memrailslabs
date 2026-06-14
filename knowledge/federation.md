---
id: clm_federation_doc
confidence: 0.93
tags: [federation, infrastructure, sql, memoryindex, nosql, architecture, stack-decisions]
aliases: [federation, three planes, government protocol infrastructure, federated nosql, managed rails]
memory_type: decision
index_path: /project/project_memrails/data_model
summary: Three planes — SQL is government (authority/placement), MemoryIndex is protocol (retrieval), federated NoSQL accounts are infrastructure (storage). No tiers.
created_at: 2026-06-14
updated_at: 2026-06-14
claim: MemRails separates three planes. SQL is the government plane — registry, scope, policy, audit, metering, and placement authority. MemoryIndex is the protocol plane — the reasoning-tree retrieval contract, independent of where memory is stored. Federated NoSQL accounts are the infrastructure plane — memory bodies live across a federation of NoSQL accounts stitched into one logical store. SQL governs placement, the protocol retrieves across the federation, and the user never brings or sees accounts. There are no infrastructure tiers or pools.
---

# Three Planes

| Plane | Layer | Responsibility |
|---|---|---|
| **Government** | SQL (PostgreSQL) | registry, scope, policy, audit, metering, **placement authority** |
| **Protocol** | MemoryIndex | reasoning-tree retrieval contract — *what* is relevant, not *where* it lives |
| **Infrastructure** | Federated NoSQL accounts | physical storage of memory bodies, stitched into one logical store |

```txt
        memory.retrieve()
              │
   ┌──────────┴───────────┐
   │   SQL = government    │  governs placement + policy + metering
   └──────────┬───────────┘
              │ resolves location
   ┌──────────┴────────────┐
   │ MemoryIndex = protocol │  selects relevant memory across the federation
   └──────────┬────────────┘
              │ reads bodies
   ┌──────────┴────────────┐
   │ Federated NoSQL = infra│  acct_canonical · acct_written · …
   └───────────────────────┘
```

## The federation

The infrastructure plane is a **flat federation of NoSQL accounts** — no tiers,
no pools. SQL is authority over which account holds which memory body (the
`storage_ref`); the protocol reads across accounts to assemble a bundle.

MVP federation (file-canonical):

- `acct_canonical` → curated corpus (`file:knowledge`)
- `acct_written` → agent-written memory (`file:written-memory.jsonl`)

Real NoSQL accounts (Mongo, Couchbase, Scylla, …) join the federation by
implementing a provider behind `Federation`; nothing above the infrastructure
plane changes. The user does not bring accounts and never sees them — managed,
governed, invisible.
