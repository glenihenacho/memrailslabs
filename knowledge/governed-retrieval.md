---
id: clm_governed_retrieval_doc
confidence: 0.95
tags: [retrieval, governed, pipeline, ranking, modes, retrieval-architecture]
aliases: [governed retrieval, retrieval pipeline, ranking formula, retrieval modes]
memory_type: note
index_path: /project/project_memrails/retrieval_architecture
summary: The retrieval pipeline runs scope → policy → tree branch selection → ranking → token-budgeted bundle → telemetry, with a transparent additive score.
created_at: 2026-06-14
updated_at: 2026-06-14
---

# Governed Retrieval

> Do not build "vector memory." Build governed memory retrieval.

## Pipeline

```txt
1. memory.retrieve(task_context)
2. Auth → resolve owner / project / agent scope
3. Policy → filter accessible memory (reason on every rejection)
4. MemoryIndex → select relevant branches by tree reasoning
5. Candidate gather from selected nodes (mode-dependent)
6. Rank → freshness / confidence / contradiction / token cost
7. Assemble context bundle within token budget
8. Log retrieval telemetry
9. Return bundle to the local agent
```

## Retrieval modes

| Mode | Behavior |
|---|---|
| `exact` | SQL/entity lookup by id, alias, or tag |
| `tree` | MemoryIndex reasoning retrieval (default) |
| `hybrid` | tree + exact + optional vector fallback |
| `hot` | most recently updated memory in scope |
| `debug` | tree + full scoring breakdown in the trace |

## Transparent ranking

Scoring is additive and fully reported — memory infrastructure needs
explainability, never an opaque score:

```txt
final_score =
    relevance + scope_match + recency + confidence + usage_success
  − staleness_penalty − contradiction_penalty − sensitivity_penalty
  − token_cost_penalty
```

In `debug` mode every term is returned per candidate in
`retrieval_trace.scoring`.
