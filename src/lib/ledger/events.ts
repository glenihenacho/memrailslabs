import { randomUUID } from 'node:crypto';
import type { LedgerEvent, LedgerEventType } from '@/types/ledger';
import type { MemoryPacket } from '@/types/packet';
import { appendEvent, readAllEvents } from './jsonl';
import { schemaVersionOf } from './catalog';
import { authorityMode } from '@/lib/memory/authority/mode';
import { persistLedgerEvent } from '@/lib/memory/authority/persist';
import { getDb } from '@/lib/memory/authority/client';

/**
 * Ledger emission — conversion phase C3.
 *
 * Events are the spine every projection consumes. Construction is pure
 * (`buildEvent`), emission dispatches by authority mode:
 *
 *   file     → JSONL append (`data/logs/ledger.jsonl`), unchanged.
 *   postgres → `ledger_events` table; JSONL becomes an *export format* of
 *              the table (`npm run ledger:export`), not a live write.
 *   dual     → both, for the migration window.
 *
 * Governance transitions do NOT go through `logEvent` — they commit through
 * `upsertEntryWithEvent` (governance.ts) so the state change and its event
 * share one transaction.
 */

export function newEventId(): string {
  return `evt_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

/** Pure construction — no side effects; callers may pre-assign event_id via extra. */
export function buildEvent(
  type: LedgerEventType,
  metadata: Record<string, unknown>,
  extra: Partial<LedgerEvent> = {},
): LedgerEvent {
  return {
    event_id: newEventId(),
    event_type: type,
    schema_version: schemaVersionOf(type),
    metadata,
    created_at: new Date().toISOString(),
    ...extra,
  };
}

/** Emit a constructed event through the active ledger backend(s). */
export function emitEvent(event: LedgerEvent): void {
  const mode = authorityMode();
  if (mode !== 'postgres') appendEvent(event);
  if (mode !== 'file') persistLedgerEvent(event);
}

export function logEvent(
  type: LedgerEventType,
  metadata: Record<string, unknown>,
  extra: Partial<LedgerEvent> = {},
): LedgerEvent {
  const event = buildEvent(type, metadata, extra);
  emitEvent(event);
  return event;
}

/**
 * Read the full ledger from the active backend, oldest first. In postgres
 * mode this reads the table (in `seq` order); in file/dual mode the JSONL.
 */
export async function readLedger(): Promise<LedgerEvent[]> {
  if (authorityMode() !== 'postgres') return readAllEvents();
  const db = await getDb();
  const res = await db.query<{ event: LedgerEvent }>(
    'SELECT event FROM ledger_events ORDER BY seq',
  );
  return res.rows.map((r) => r.event);
}

export function logPacket(packet: MemoryPacket, latency_ms: number): void {
  logEvent('QUERY', { query: packet.query, latency_ms, layer: packet.resolved_layer });
  logEvent(
    'PACKET_CREATED',
    {
      query: packet.query,
      layer: packet.resolved_layer,
      tokens: packet.tokens,
      confidence: packet.confidence,
      latency_ms,
    },
    {
      packet_id: packet.packet_id,
      input_hash: packet.input_hash,
      output_hash: packet.output_hash,
    },
  );
}
