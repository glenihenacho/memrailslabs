---
id: clm_data_model_doc
confidence: 0.9
tags: [data-model, schema, postgres, registry, stack, stack-decisions]
aliases: [data model, schema, registry tables, postgres schema]
memory_type: note
index_path: /project/project_memrails/data_model
summary: PostgreSQL is the authority layer (registry, scope, policy, audit, metering); implemented in C2 as an embedded Postgres (PGlite) behind the kernel seams, with the file-canonical overlay kept as the conforming lightweight backend.
created_at: 2026-06-14
updated_at: 2026-07-05
---

# Data Model

PostgreSQL is the authority layer. As of conversion phase C2 it is
**implemented**: an embedded Postgres (PGlite; a hosted deploy points the same
schema at a pg-wire server) behind the `store.ts`/`governance.ts` seams —
`src/lib/memory/authority/`. Backend selection is `MEMRAILS_AUTHORITY`
(`file` | `dual` | `postgres`); `dual` is the migration window (file
authoritative, Postgres shadowing every write), verified by
`npm run authority:diff` and migrated by `npm run authority:migrate` (the §6
export/import tool pointed at Postgres). The file-canonical form — curated
`knowledge/**.md` + JSON governance overlay + JSONL stores — remains a
conforming lightweight backend for self-hosted/local mode, and maps one-to-one
onto the tables.

| Production table | File-canonical MVP |
|---|---|
| `owners`, `agents`, `projects` | implicit scope defaults + frontmatter |
| `memory_registry` | `knowledge/**.md` + `data/written-memory.jsonl` |
| `memory_packets` | markdown body / JSONL record body |
| `memory_versions` | `data/governance.json` → `versions[]` |
| `memory_index_nodes/edges/memberships` | derived from `index_path` at load |
| `retrieval_events` / `retrieval_results` | `data/logs/retrievals.jsonl` |
| `memory_feedback` | `data/logs/feedback.jsonl` |

## Registry record

`memory_id`, `scope{owner_id, project_id, agent_id}`, `memory_type`, `status`,
`confidence`, `sensitivity`, `content`, `summary`, `tags`, `source_file`,
`source_refs`, `contradictions`, `index_path`, `current_version`,
`superseded_by`, `created_at`, `updated_at`, `expires_at`.

## Rails

See `stack.md` for the canonical rail map. Core = Postgres + MemoryIndex +
Redis + R2. Authority (Postgres) and analytics (ClickHouse) are global planes;
the federated NoSQL accounts are per-owner. Specialized rails (pgvector/Qdrant,
Neo4j, ClickHouse, OpenSearch, Couchbase, ScyllaDB, Firestore) are added only on
measured pressure. None define the product; the MemoryIndex tree does.
