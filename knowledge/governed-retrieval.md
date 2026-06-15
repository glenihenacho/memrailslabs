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
6. Rank → blended L1–L3 relevance (stemmed, IDF-weighted) + freshness / confidence / contradiction / token cost, then L4 relevance floor
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

### Relevance is a blend of the evolved L1–L3 layer signals

`relevance` is not a flat token count. It combines the three retrieval layers,
each computed on a shared, model-free **lexical core** (`src/lib/memory/lexical.ts`):

```txt
relevance = 0.5·semantic(L3) + 0.3·lexical(L1) + 0.2·structural(L2)
```

| Signal | Layer | What it measures |
|---|---|---|
| `lexical` | L1 | literal phrase / raw token coverage |
| `structural` | L2 | query names the record's id, alias, or tag |
| `semantic` | L3 | IDF-weighted, **stemmed** token overlap |

Two upgrades drive recall and precision without a model:

- **Stemming** — `retrieve / retrieval / retrieves / retrieving / retrieved`
  collapse to one stem, so morphological variants match.
- **IDF weighting** — rare query terms outweigh filler (BM25-lite), computed
  once over in-scope memory. Branch selection uses the same weighted overlap.

The per-layer signals are returned in `retrieval_trace.scoring[].relevance_signals`.

### L4 evidence floor

After ranking, a candidate that shares **no** lexical, structural, or semantic
signal with the query is branch noise and is dropped — surfaced in `omitted`
with reason `no L1–L3 relevance signal (below floor)`. The top-ranked memory
always passes, so the floor never empties a bundle. High confidence does not
rescue an irrelevant memory.
