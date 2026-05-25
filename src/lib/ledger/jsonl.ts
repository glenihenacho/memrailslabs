import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { LedgerEvent } from '@/types/ledger';

const LEDGER_PATH = resolve(process.cwd(), 'data', 'logs', 'ledger.jsonl');

export function appendEvent(event: LedgerEvent): void {
  if (!existsSync(dirname(LEDGER_PATH))) {
    mkdirSync(dirname(LEDGER_PATH), { recursive: true });
  }
  appendFileSync(LEDGER_PATH, `${JSON.stringify(event)}\n`, 'utf8');
}

export function readAllEvents(): LedgerEvent[] {
  if (!existsSync(LEDGER_PATH)) return [];
  const raw = readFileSync(LEDGER_PATH, 'utf8');
  const events: LedgerEvent[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    try {
      events.push(JSON.parse(trimmed) as LedgerEvent);
    } catch {
      // Skip malformed lines silently — bad lines should not break the stream.
    }
  }
  return events;
}

export function ledgerPath(): string {
  return LEDGER_PATH;
}
