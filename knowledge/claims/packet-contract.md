---
id: clm_packet_contract
confidence: 0.97
tags: [packet, contract, protocol]
aliases: [packet contract, memorypacket, packet schema]
index_path: /project/project_memrails/packet_contract
memory_type: claim
summary: A packet is a billable answer unit carrying answer text, confidence, tokens, provenance, evidence IDs, contradictions, hashes, and the compressor version — never anonymous prose.
created_at: 2026-05-25
updated_at: 2026-05-25
claim: A MemRails packet is a billable answer unit that must include answer text, confidence, token count, provenance references, evidence IDs, contradictions surfaced, input hash, output hash, and the model or compressor version. No packet ships as anonymous prose.
---

# Packet Contract

Every packet returned by `memory.query()` ships with:

- `packet_id` — opaque identifier.
- `query` and `intent` — what was asked.
- `packet` — the answer text.
- `confidence` — averaged over cited evidence.
- `tokens` — estimated token count.
- `contradictions_surfaced` — count of conflicting claims.
- `evidence[]` — `claim_id`, `weight`, `source_file` for each cited claim.
- `input_hash` and `output_hash` — sha256 fingerprints.
- `model_or_compressor` — name of the synthesizer.
- `resolved_layer` — which retrieval layer answered.
- `created_at` — ISO timestamp.

This shape is model-agnostic. Claude, OpenAI, local models, and Compress-v1
can all produce packets that fit the contract.
