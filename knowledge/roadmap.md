---
id: clm_roadmap_doc
confidence: 0.9
tags: [roadmap, phases, plan, milestones]
aliases: [roadmap, phases, build plan, ship plan]
memory_type: decision
index_path: /project/project_memrails/roadmap
summary: Phase 1 governed packets, Phase 2 memory.retrieve, Phase 3 MemoryIndex, Phase 4 SDKs, Phase 5 telemetry quality, Phase 6+ scale only what hurts.
created_at: 2026-06-14
updated_at: 2026-06-14
---

# Roadmap

> Phase 1: build governed memory packets. Phase 2: ship `memory.retrieve()`.
> Phase 3: add MemoryIndex reasoning retrieval. Phase 4: integrate local-agent
> SDKs. Phase 5: add telemetry-driven memory quality. Phase 6: scale only the
> rails that hurt.

| Phase | Goal | Status in this repo |
|---|---|---|
| 0 | Scope lock — freeze `memory.retrieve()` as the primitive | ✅ docs + non-goals |
| 1 | Governed memory registry (write, get, delete, scope, audit) | ✅ file-canonical registry |
| 2 | `memory.retrieve()` → context bundle + telemetry | ✅ implemented |
| 3 | MemoryIndex v1 — tree nodes, branch reasoning, debug trace | ✅ implemented |
| 4 | SDK + local-agent integration (Python, TS, CLI, MCP) | ✅ stubs shipped |
| 5 | Memory quality telemetry (feedback, staleness, contradiction) | ◻ partial (feedback + trace) |
| 6 | Supersession & contradiction system | ✅ implemented |
| 7 | Encrypted packet storage (object storage) | ◻ interface TODO |
| 8 | Optional pgvector fallback | ◻ stubbed rail |
| 9 | Evals & benchmark harness | ◻ planned |
| 10 | Hosted beta | ◻ planned |
| 11 | Scale layer (ClickHouse, Qdrant, Neo4j, TurboQuant) | ◻ add when it hurts |
| 12 | Enterprise controls (roles, retention, audit posture) | ◻ planned |

## Priority build list

1. memory packet spec · 2. registry · 3. `memory.write()` ·
4. `memory.retrieve()` · 5. context bundle · 6. MemoryIndex node schema ·
7. tree retrieval · 8. SDK · 9. retrieval telemetry · 10. supersession.
