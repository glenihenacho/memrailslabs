---
id: clm_memory_index
confidence: 0.94
tags: [memoryindex, pageindex, tree, retrieval, reasoning, retrieval-architecture]
aliases: [memory index, memoryindex, reasoning tree, tree retrieval, pageindex]
memory_type: decision
index_path: /project/project_memrails/memory_index
summary: MemoryIndex is a PageIndex-inspired hierarchical tree; retrieval is a reasoning tree-walk over relevant branches, not flat vector top-k.
created_at: 2026-06-14
updated_at: 2026-06-14
claim: The primary retrieval structure is a PageIndex-inspired MemoryIndex — a hierarchical tree (owner → project → topic → memory) stored as nodes, edges, and memberships. Retrieval selects relevant branches by reasoning over node titles, summaries, and paths, then gathers and ranks member memories. Vector search (pgvector/Qdrant) is an optional fallback rail, never the core.
---

# MemoryIndex

Agent memory is naturally hierarchical, so MemRails stores it as a tree and
retrieves by tree-walk:

```txt
User
├── Preferences
├── Long-term Decisions
└── Projects
    └── MemRails
        ├── Product Definition
        ├── Retrieval Architecture
        ├── Encryption / Storage Model
        ├── Stack Decisions
        ├── Rejected Assumptions
        └── Roadmap
```

The index compiler creates, merges, splits, and re-homes nodes, summarizes
branches, and flags stale ones. Tree reasoning replaces
`conversation → chunk → embed → top_k`, which is undifferentiated.

Branch selection scores each branch's title, summary, and path against the task
with the same model-free lexical core as record ranking — **stemmed** tokens
(so `pricing` matches `priced`) weighted by **IDF** over the branches, so a
distinctive branch term outweighs a common one. See
`knowledge/governed-retrieval.md` for the blended L1–L3 relevance.
