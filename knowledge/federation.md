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
claim: MemRails separates three planes. SQL is the government plane — registry, scope, policy, audit, metering, and placement authority. MemoryIndex is the protocol plane — the reasoning-tree retrieval contract, independent of where memory is stored. Federated NoSQL accounts are the infrastructure plane — one NoSQL account namespace per owner/email, provisioned at enrollment, stitched into one logical store. SQL governs placement, the protocol retrieves within the owner's namespace, and the user never brings or sees accounts. Tenant isolation is physical, not just a scope filter. There are no infrastructure tiers or pools.
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
   │ Federated NoSQL = infra│  acct_<ownerA> · acct_<ownerB> · …
   └───────────────────────┘
```

## The federation — one namespace per owner

The infrastructure plane is a **per-owner federation** — one NoSQL account
namespace per owner/email, provisioned at enrollment. No tiers, no pools. SQL is
authority over placement (owner → namespace); the protocol retrieves *within*
the owner's namespace. Tenant isolation is physical: two owners cannot see each
other's memory because their bodies live in different accounts.

MVP (file-canonical): each owner's namespace is a directory.

- `acct_<owner>` → `data/federation/<owner>/written.jsonl` (agent-written memory)
- the curated seed corpus (`/knowledge/**.md`) is the platform owner's namespace

Real NoSQL accounts (a per-tenant Mongo/Couchbase/Scylla database) join the
federation by implementing a provider behind `Federation` — nothing above the
infrastructure plane changes. The user does not bring accounts and never sees
them; enrollment (one email) provisions one namespace, managed and invisible.
