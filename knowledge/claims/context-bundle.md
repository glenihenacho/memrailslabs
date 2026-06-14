---
id: clm_context_bundle
confidence: 0.96
tags: [bundle, context, retrieve, output, provenance, retrieval-architecture]
aliases: [context bundle, bundle contract, retrieve output]
memory_type: claim
index_path: /project/project_memrails/retrieval_architecture
summary: A context bundle is the governed output of memory.retrieve — scored memories, omissions with reasons, and a retrieval trace.
created_at: 2026-06-14
updated_at: 2026-06-14
claim: memory.retrieve() returns a context bundle, the governed evolution of the packet. It carries context_bundle_id, scored memories (each with summary, confidence, status, reason_selected), an omitted list with reasons, token accounting, and a retrieval_trace listing branches selected and policy filters applied. A synthesized packet is attached only when the caller asks for it.
---

# Context Bundle

The context bundle reconciles the packet contract with governed retrieval:

- **memories[]** — `memory_id`, `summary`, `confidence`, `status`,
  `reason_selected`, `score`, `tokens`, `source_file`, `index_path`.
- **omitted[]** — `memory_id` + human reason (superseded, disputed, budget).
- **retrieval_trace** — mode, root nodes visited, branches selected, policy
  filters applied, candidates considered, optional scoring breakdown.
- **packet?** — optional synthesized answer when `include_packet` is set.

Every selection and every omission is explainable. No anonymous prose.
