---
id: clm_memory_supersession
confidence: 0.93
tags: [supersede, dispute, forget, lifecycle, contradiction, truth]
aliases: [supersession, supersede, dispute, forget, changing truth]
memory_type: decision
index_path: /project/project_memrails/retrieval_architecture
summary: Changing truth is handled by supersede, dispute, and forget — old memory leaves active retrieval but its history is preserved.
created_at: 2026-06-14
updated_at: 2026-06-14
claim: MemRails handles changing truth with three lifecycle operations. Supersede marks old memory superseded and points it at a replacement. Dispute flags a memory, drops its confidence, and excludes it unless explicitly requested. Forget tombstones a memory out of active retrieval. All three preserve the evidence chain and version history; none silently rewrite canonical memory.
---

# Supersession, Dispute, Forget

- **supersede** — old → `superseded`, `superseded_by` points to the new memory.
- **dispute** — old → `disputed`, confidence halved, excluded unless
  `include_disputed` is requested.
- **forget** — old → `tombstoned`, removed from active retrieval, audit-safe.

The system stops returning outdated memory, preserves history, and explains
why old memory was omitted.
