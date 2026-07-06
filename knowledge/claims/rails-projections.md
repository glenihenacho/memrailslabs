---
id: clm_rails_projections
confidence: 0.95
tags: [rails, projections, hot, artifact, graph, consumers]
aliases: [rails as projections, hot rail, artifact rail, graph projection, taint, blast radius]
index_path: /project/project_memrails/stack_decisions
memory_type: claim
summary: The V1 rails are ledger projections — the hot rail invalidates on lifecycle events (never TTL), the artifact rail stores content-addressed encrypted blobs with Postgres pointers, and the graph projection answers taint/ancestry/clusters/centrality over structure only — each droppable and rebuildable from the spine.
created_at: 2026-07-06
updated_at: 2026-07-06
---

# Rails as ledger projections (conversion phase C4)

- Rails receive events two ways with **one handler**: the in-process bus
  (live) and a cursor-tracked ledger consumer (rebuild) — so dropping any
  rail and replaying the spine reconstructs the identical state. Postgres
  wins all disagreements.
- **Hot rail** (`rails/hot.ts`, Redis stand-in): recent/high-usage memory
  ids backing `mode: 'hot'`; a superseded, disputed, or tombstoned memory
  leaves the rail **on its event, never on a TTL**.
- **Artifact rail** (`rails/artifact.ts`, R2/S3 stand-in): bodies
  content-addressed at `artifact://sha256/<hex>` (matching the
  `MemorySourceRef.hash` scheme), AES-256-GCM encrypted at rest; Postgres
  stores pointers only (`artifacts` table); the archive consumer replays
  bundles from the `retrievals` table.
- **Graph projection** (`rails/graph.ts`, Neo4j stand-in): nodes Memory /
  Source (hash-deduped) / Agent / IndexNode with **no content on nodes**;
  edges SUPERSEDED_BY, CONTRADICTS, DERIVED_FROM, HANGS_UNDER, CHANGED,
  timestamped from their ledger events, MERGE-idempotent. One tool —
  `memrails.memory.graph(query_type, root_id, depth)` — with a fixed menu:
  `taint` (blast radius), `ancestry`, `clusters`, `centrality`.
- **Not built** (triggers per the rail-roles decision): ClickHouse,
  OpenSearch, ScyllaDB, Qdrant — added only on measured pressure. Firestore
  is out of contract.
