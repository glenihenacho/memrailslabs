---
id: clm_rails_doc
confidence: 0.93
tags: [rails, managed, infrastructure, pools, byo, stack, stack-decisions]
aliases: [managed rails, rail router, no byo, rail pools, backend rails]
memory_type: decision
index_path: /project/project_memrails/data_model
summary: MemRails operates managed backend rails behind one API; users never bring or see rails. Internal pools (free/shared/overflow/dedicated) are a cost strategy, not a user surface.
created_at: 2026-06-14
updated_at: 2026-06-14
claim: Backend rails are fully MemRails-managed and invisible. The user does not bring Neon, Upstash, R2, or Qdrant — MemRails operates managed rail pools, routes retrieval internally, absorbs provider complexity, and handles migration. The public API stays memory.retrieve() regardless of which rail or pool serves a request. Internal pools (free, shared, overflow, dedicated) are a margin/cost-optimization strategy, never a commercial quota or a user-facing choice.
---

# Managed Rails

The user sees one API call. MemRails operates the rails behind it.

| Rail | Role |
|---|---|
| PostgreSQL | authority, registry, scope, audit, metering |
| MemoryIndex | primary retrieval structure |
| Object storage | memory packets, evidence, artifacts |
| Redis | cache, locks, hot retrieval state |
| Telemetry store | retrieval logs, memory quality |
| Qdrant / pgvector | optional semantic fallback |
| Neo4j / ClickHouse | optional graph / analytics, later |

## No BYO

Not "bring your own Neon / Upstash / R2 / Qdrant." MemRails manages rails,
routes internally, absorbs provider complexity, and migrates rails without API
changes. The `RailRouter` is the seam: swapping the file-canonical MVP for real
providers changes nothing above the router.

## Internal pools (cost strategy, invisible)

`free → shared → overflow → dedicated`. Pool selection optimizes infrastructure
cost and failover; it is never exposed and never a commercial limit. Relying on
third-party free tiers for production is a deployment decision to validate
carefully (ToS, isolation, durability) — the router lets MemRails choose without
the product or the user ever depending on it.
