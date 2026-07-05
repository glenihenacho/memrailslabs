import type { LedgerEvent } from '@/types/ledger';
import { getDb } from '@/lib/memory/authority/client';

/**
 * Ledger consumer framework — conversion phase C3.
 *
 * Every rail added in C4+ (Redis hot, R2 artifacts, Neo4j graph) is a
 * consumer of the event spine: cursor-tracked so it resumes where it left
 * off, idempotent by `event_id` so re-delivery is harmless, and ordered by
 * `seq` so replay is deterministic. A projection built this way can be
 * dropped and rebuilt from the stream at any time — which is exactly what
 * the rebuild test does.
 *
 * Postgres-mode only: the spine lives in `ledger_events`; the file backend
 * has no consumer infrastructure (its JSONL is read wholesale instead).
 */

export type LedgerConsumer = {
  /** Stable name — the cursor is keyed by it. */
  name: string;
  /** Handle one event. Must be idempotent: re-delivery of an event_id is legal. */
  handle: (event: LedgerEvent, seq: number) => Promise<void> | void;
};

export type ConsumeResult = {
  consumer: string;
  processed: number;
  from_seq: number;
  to_seq: number;
};

type EventRow = { seq: string | number; event: LedgerEvent };

/**
 * Run a consumer from its cursor to the head of the spine. Events are
 * delivered in `seq` order; the cursor advances only after the handler
 * returns, so a crash re-delivers (never skips) — hence the idempotence
 * requirement.
 */
export async function runConsumer(consumer: LedgerConsumer, opts: { batch?: number } = {}): Promise<ConsumeResult> {
  const db = await getDb();
  const batch = opts.batch ?? 500;

  const cursorRes = await db.query<{ last_seq: string | number }>(
    'SELECT last_seq FROM ledger_cursors WHERE consumer = $1',
    [consumer.name],
  );
  const from_seq = Number(cursorRes.rows[0]?.last_seq ?? 0);

  let last = from_seq;
  let processed = 0;
  const seen = new Set<string>(); // per-run idempotence guard by event_id

  for (;;) {
    const rows = await db.query<EventRow>(
      'SELECT seq, event FROM ledger_events WHERE seq > $1 ORDER BY seq LIMIT $2',
      [last, batch],
    );
    if (rows.rows.length === 0) break;
    for (const row of rows.rows) {
      const seq = Number(row.seq);
      if (!seen.has(row.event.event_id)) {
        seen.add(row.event.event_id);
        await consumer.handle(row.event, seq);
        processed += 1;
      }
      last = seq;
      await db.query(
        `INSERT INTO ledger_cursors (consumer, last_seq, updated_at) VALUES ($1, $2, now())
         ON CONFLICT (consumer) DO UPDATE SET last_seq = $2, updated_at = now()`,
        [consumer.name, last],
      );
    }
  }

  return { consumer: consumer.name, processed, from_seq, to_seq: last };
}

/** Test-only: rewind a consumer's cursor to zero (forces full replay). */
export async function resetConsumerCursor(name: string): Promise<void> {
  const db = await getDb();
  await db.query('DELETE FROM ledger_cursors WHERE consumer = $1', [name]);
}

/**
 * The first consumer: a no-op replayer that only counts. Used in tests to
 * prove cursor advancement, idempotence, and replay determinism before any
 * real rail consumes the spine (C4).
 */
export function noopReplayer(name = 'noop_replayer'): LedgerConsumer & { events: LedgerEvent[] } {
  const events: LedgerEvent[] = [];
  return {
    name,
    events,
    handle(event) {
      events.push(event);
    },
  };
}
