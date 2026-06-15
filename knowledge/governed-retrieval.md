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
4. L1 rigorous grep → if literal evidence clears the adaptive bar, resolve here and skip semantic
5. MemoryIndex → otherwise select relevant branches by tree reasoning
6. Candidate gather from selected nodes (mode-dependent)
7. Rank → blended L1–L3 relevance (stemmed, IDF-weighted) + freshness / confidence / contradiction / token cost, then L4 relevance floor
8. Assemble context bundle within token budget
9. Log retrieval telemetry
10. Return bundle to the local agent
```

## Retrieval modes

| Mode | Behavior |
|---|---|
| `exact` | SQL/entity lookup by id, alias, or tag |
| `tree` | MemoryIndex reasoning retrieval (default) |
| `hybrid` | tree + exact + optional vector fallback |
| `hot` | most recently updated memory in scope |
| `debug` | tree + full scoring breakdown in the trace |

## Rigorous grep short-circuit (adaptive)

Cheap filters before expensive synthesis (Rule 2). Before the tree path runs, a
**rigorous L1 grep** scores every in-scope memory by *literal, whole-word*
coverage (`literalCoverage` — an exact phrase scores 1; otherwise the fraction
of distinct query words present verbatim). If a memory clears the coverage bar
**and** the evidence floor (confidence ≥ 0.75), the query is resolved at L1 and
the L3 semantic blend is **skipped entirely** — ranking uses the cheap
lexical/structural signals only.

The coverage bar is **adaptive**, tuned by the recent cache-hit rate:

```txt
grep_threshold = COLD − (COLD − HOT) · cache_hit_rate     (COLD 0.9, HOT 0.6)
```

Each retrieval has a signature (scope + normalized task context). A signature
seen again inside the warm window is a cache hit; a rolling window of recent
hits gives `cache_hit_rate`. When hits are frequent (stable / repeated traffic),
the bar drops and grep is trusted to resolve more aggressively; when novel
queries dominate, the bar stays strict and retrieval falls through to the
semantic tree-walk. The trace reports `resolved_layer`, `semantic_skipped`,
`cache_hit_rate`, and `grep_threshold` (`src/lib/memory/cache.ts`).

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
