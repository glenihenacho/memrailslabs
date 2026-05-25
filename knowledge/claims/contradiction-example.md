---
id: clm_contradiction_example
confidence: 0.4
tags: [packet, contract, contradiction, stale]
aliases: [anonymous packet, packet without provenance]
created_at: 2026-05-25
updated_at: 2026-05-25
claim: An older draft of the packet contract allowed packets to ship without explicit provenance during fallback synthesis. This contradicts the current §2 Rule 3 and §6 packet shape.
---

# Contradiction Example — packets without provenance

This claim is intentionally low-confidence (0.4) so that L4 filters it out of
the evidence list, while still surfacing the contradiction count on packets
that cite the canonical packet-contract claim. It exists to prove the
contradiction surface in `§9` Console renders.

The current authoritative position (`clm_packet_contract`, `clm_evidence_floor`)
is that **no packet ships as anonymous prose**.
