import type { LedgerEventType } from '@/types/ledger';

/**
 * Ledger event catalog — conversion phase C3.
 *
 * The ledger is the event spine: every rail added in C4+ is a consumer of
 * this stream, so event types are formalized here with versioned payload
 * schemas and stable ids (`event_id` is assigned once at emit and never
 * reused). A payload change bumps the type's `schema_version`; consumers
 * branch on it, never on guesswork.
 *
 * Wire names predate the catalog and are kept stable (renames would break
 * the deployed JSONL history): `MEMORY_WRITTEN` is the plan's
 * MEMORY_CREATED, `MEMORY_DELETED` is TOMBSTONED, `MEMORY_RETRIEVED` is
 * RETRIEVAL_COMPLETED.
 *
 * **Governance events** are the replayable subset: each carries
 * `metadata.overlay_entry` — the full resulting `GovernanceOverlayEntry`
 * after the change — so folding them in `seq` order reconstructs governance
 * state exactly (`src/lib/ledger/replay.ts`). That is what makes every
 * projection rebuildable from the stream.
 */

export type CatalogEntry = {
  schema_version: number;
  /** Replayable governance transition: metadata carries `overlay_entry`. */
  governance: boolean;
  description: string;
};

export const EVENT_CATALOG: Record<LedgerEventType, CatalogEntry> = {
  // Governed memory lifecycle — the replayable spine.
  MEMORY_WRITTEN: {
    schema_version: 2, // v2: + source_refs, index_path, confidence
    governance: false, // creation seeds the registry, not the overlay
    description: 'A governed record was created (or deduplicated) via memory.write().',
  },
  MEMORY_SUPERSEDED: {
    schema_version: 1,
    governance: true,
    description: 'A record was superseded and points at its replacement.',
  },
  MEMORY_DISPUTED: {
    schema_version: 1,
    governance: true,
    description: 'A record was disputed: confidence dropped, excluded unless opted in.',
  },
  MEMORY_RESTORED: {
    schema_version: 1,
    governance: true,
    description: 'A disputed record was restored to active at its stated confidence.',
  },
  MEMORY_CONFIDENCE_UPDATED: {
    schema_version: 1,
    governance: true,
    description: "A record's confidence was re-scored without a status change.",
  },
  MEMORY_DELETED: {
    schema_version: 1,
    governance: true,
    description: 'A record was tombstoned (forget) — out of retrieval, id + events retained.',
  },
  MEMORY_GOVERNANCE_IMPORTED: {
    schema_version: 1,
    governance: true,
    description: 'A §6 import applied governance state for one memory_id.',
  },
  // Retrieval + feedback telemetry.
  MEMORY_RETRIEVED: {
    schema_version: 2, // v2: + memory_ids of the returned bundle
    governance: false,
    description: 'One memory.retrieve() completed; metadata summarizes the bundle.',
  },
  FEEDBACK_RECORDED: {
    schema_version: 2, // v2: + memory_ids fan-out of the rated retrieval
    governance: false,
    description: 'Usage feedback recorded against a retrieval (scorer input in C5).',
  },
  RETRIEVAL_BILLED: {
    schema_version: 1,
    governance: false,
    description: 'Metering: one billable retrieval charged.',
  },
  // Portability.
  MEMORY_EXPORTED: {
    schema_version: 1,
    governance: false,
    description: 'A §6 export ran; metadata carries the counts.',
  },
  MEMORY_IMPORTED: {
    schema_version: 1,
    governance: false,
    description: 'A §6 import ran; metadata carries the report counts.',
  },
  // Packet-era events (L1–L5 synthesis surface).
  QUERY: { schema_version: 1, governance: false, description: 'A packet query ran.' },
  PACKET_CREATED: { schema_version: 1, governance: false, description: 'A packet was synthesized.' },
  MCP_TOOL_CALL: { schema_version: 1, governance: false, description: 'An MCP tool was invoked.' },
  REFACTOR_PROPOSED: { schema_version: 1, governance: false, description: 'A memory refactor was proposed.' },
  REFACTOR_ACCEPTED: { schema_version: 1, governance: false, description: 'A memory refactor was accepted.' },
  PAYMENT_AUTHORIZED: { schema_version: 1, governance: false, description: 'A payment session was authorized.' },
  PACKET_BILLED: { schema_version: 1, governance: false, description: 'A packet was billed.' },
};

export function schemaVersionOf(type: LedgerEventType): number {
  return EVENT_CATALOG[type]?.schema_version ?? 0;
}

export function isGovernanceEvent(type: LedgerEventType): boolean {
  return EVENT_CATALOG[type]?.governance ?? false;
}
