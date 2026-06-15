---
id: clm_stack_doc
confidence: 0.94
tags: [stack, rails, postgres, redis, r2, clickhouse, infrastructure, stack-decisions]
aliases: [canonical stack, rails, rail map, final stack, v1 stack, core rails]
memory_type: decision
index_path: /project/project_memrails/stack_decisions
summary: Core stack is Postgres + MemoryIndex + Redis + R2. Authority (Postgres) and analytics (ClickHouse) are global planes; federated NoSQL accounts are per-owner. Specialized rails added only on measured pressure.
created_at: 2026-06-15
updated_at: 2026-06-15
claim: The canonical MemRails core stack is PostgreSQL (authority) + MemoryIndex (retrieval) + Redis (hot) + S3/R2 (artifacts), with telemetry on Postgres first. Authority (Postgres), telemetry, and analytics (ClickHouse) are global planes spanning all tenants; the federated NoSQL accounts (artifact/document) are per-owner. Specialized rails — pgvector/Qdrant, Neo4j, ClickHouse, OpenSearch, Couchbase, ScyllaDB, Firestore — are added only after a measurable bottleneck. Postgres governs, MemoryIndex retrieves, Redis accelerates, R2 preserves, and retrieval telemetry prices the system.
---

# Canonical Stack

> Postgres governs, MemoryIndex retrieves, Redis accelerates, R2 preserves, and
> retrieval telemetry prices the system.

## V1 core rails (ship)

| Rail | Tool | Plane | Role |
|---|---|---|---|
| Authority | PostgreSQL | **global** | owners, agents, projects, registry, policy, audit, metering |
| Primary Retrieval | MemoryIndex | per-owner | PageIndex-style hierarchical retrieval |
| Hot | Redis | **global** | cache, locks, hot retrieval state |
| Artifact | S3 / R2 / MinIO | per-owner | packets, evidence, exports, snapshots |
| Telemetry | PostgreSQL first | **global** | retrieval logs, quality scores, billing events |

Recommended providers: Postgres → Neon/Supabase · Hot → Upstash Redis ·
Artifacts → Cloudflare R2 · Search → Postgres FTS · Vector → none (pgvector
optional later).

## Global vs per-owner

- **Global plane** (spans all tenants): Authority (Postgres), Telemetry
  (Postgres → ClickHouse), and Analytics (ClickHouse). Registry, policy,
  metering, retrieval logs, quality scores, billing events, and evals are all
  global — telemetry is never sharded per owner.
- **Per-owner plane** (federation): each owner/email is one NoSQL account
  namespace holding that tenant's memory bodies and artifacts.

## V2 specialized rails (add on pressure)

| Rail | Tool | Add when |
|---|---|---|
| Vector fallback | pgvector → Qdrant | MemoryIndex misses broad fuzzy recall |
| Graph / provenance | Neo4j | relationships / contradictions become central |
| Analytics / evals | ClickHouse | telemetry outgrows Postgres |
| Search | OpenSearch / Meilisearch | admin/debug search outgrows Postgres FTS |
| Packet / document | Couchbase | JSON packets outgrow JSONB / object storage |
| Event / timeline | ScyllaDB | raw event volume becomes massive |
| Realtime | Firestore / Couchbase Lite | live client sync becomes important |

## Phases

1. **Ship** — Postgres · MemoryIndex · Redis · R2 · Postgres FTS
2. **Recall** — + pgvector
3. **Relationships** — + Neo4j
4. **Telemetry scale** — + ClickHouse
5. **Packet/event scale** — + Couchbase · ScyllaDB
6. **Surface expansion** — + OpenSearch/Meilisearch · Firestore

The core stack is not the long NoSQL list — it is **Postgres + MemoryIndex +
Redis + R2**. Everything else is a specialized rail added only after a
measurable bottleneck. The registry is inspectable at `GET /api/stack`.
