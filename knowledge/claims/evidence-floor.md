---
id: clm_evidence_floor
confidence: 0.9
tags: [evidence, confidence, floor, filter]
aliases: [evidence floor, confidence floor, min confidence]
created_at: 2026-05-25
updated_at: 2026-05-25
claim: The default evidence floor is 0.75. Claims below the floor are excluded from packets unless explicitly requested. Contradictions are surfaced in packet metadata rather than hidden.
---

# Evidence Floor

L4 enforces a minimum-confidence gate. The default floor is **0.75**.

- Claims below the floor are excluded from packet evidence.
- Contradictions are reported in the `contradictions_surfaced` count and
  the underlying claim IDs.
- Low-coverage packets (all evidence < 0.85) are tagged `[uncertain]` in
  the compressed body.
