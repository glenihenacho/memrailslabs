import type { LedgerEvent } from '@/types/ledger';

/**
 * In-process event bus — conversion phase C4.
 *
 * Rails receive events two ways with ONE handler:
 *
 *   live    — this bus, published synchronously at emit time, keeps the
 *             in-process projection warm (a superseded memory leaves the hot
 *             rail on the event, not on a TTL);
 *   rebuild — the same handler runs as a cursor-tracked ledger consumer
 *             (`consumers.ts`), so dropping a projection and replaying the
 *             spine reconstructs exactly what the live feed built.
 *
 * The bus is best-effort fan-out: a subscriber throwing must never break the
 * write path (Postgres already has the event — the projection can rebuild),
 * so errors are logged and swallowed.
 */

type Subscriber = { name: string; handle: (event: LedgerEvent) => void };

const subscribers: Subscriber[] = [];

export function subscribe(name: string, handle: (event: LedgerEvent) => void): void {
  const existing = subscribers.findIndex((s) => s.name === name);
  if (existing >= 0) subscribers.splice(existing, 1);
  subscribers.push({ name, handle });
}

export function publish(event: LedgerEvent): void {
  for (const s of subscribers) {
    try {
      s.handle(event);
    } catch (err) {
      console.error(`[memrails bus] subscriber ${s.name} failed on ${event.event_type}:`, err);
    }
  }
}
