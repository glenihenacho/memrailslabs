---
id: clm_data_model_doc
confidence: 0.9
tags: [data-model, schema, postgres, registry, stack, stack-decisions]
aliases: [data model, schema, registry tables, postgres schema]
memory_type: note
index_path: /project/project_memrails/data_model
summary: PostgreSQL is the authority layer (registry, scope, policy, audit, metering); the MVP runs file-canonical with a JSON overlay and JSONL stores.
created_at: 2026-06-14
updated_at: 2026-06-14
---

# Data Model

In production PostgreSQL is the authority layer; the MVP is **file-canonical**:
curated `knowledge/**.md` + a JSON governance overlay + JSONL stores, which map
one-to-one onto the production tables.

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

## Scale rails (add only when they hurt)

pgvector → Qdrant (vector fallback), ClickHouse (telemetry), Neo4j
(provenance graph), TurboQuant (vector/KV-cache compression). None of these
define the product; the MemoryIndex tree does.
