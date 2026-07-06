---
id: clm_ledger_spine
confidence: 0.95
tags: [ledger, events, spine, replay, consumers, rails]
aliases: [event spine, ledger events, replay, rebuild from ledger, consumer framework]
index_path: /project/project_memrails/contract
memory_type: claim
summary: The ledger is the event spine — governance changes and their events commit in one transaction, every governance event carries the resulting overlay entry, and any projection can be dropped and rebuilt by replaying the stream.
created_at: 2026-07-05
updated_at: 2026-07-05
---

# Ledger as event spine (conversion phase C3)

- Every governance transition (supersede, dispute, restore, re-score,
  tombstone, §6 governance import) commits its overlay change and its ledger
  event in **one Postgres transaction**; the version row links back via
  `source_event_id`.
- Governance events carry `metadata.overlay_entry` — the full resulting
  entry — so folding them in `seq` order reconstructs governance state
  exactly (`src/lib/ledger/replay.ts`; proven by `tests/ledger/spine.test.ts`).
- Rails (C4+) are **consumers**: cursor-tracked in `ledger_cursors`,
  idempotent by `event_id`, ordered by `seq` (`src/lib/ledger/consumers.ts`).
  A projection built this way is droppable and rebuildable from the stream —
  never a dual-write authority.
- The event catalog (`src/lib/ledger/catalog.ts`) versions every payload;
  wire names are stable. JSONL is the ledger's **export format**
  (`npm run ledger:export`) — live in file mode, generated from the table in
  postgres mode.
