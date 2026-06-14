import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { LedgerEvent } from '@/types/ledger';
import { dataPath } from '@/lib/paths';

function ledgerFile(): string {
  return dataPath('logs', 'ledger.jsonl');
}

export function appendEvent(event: LedgerEvent): void {
  const path = ledgerFile();
  if (!existsSync(dirname(path))) {
    mkdirSync(dirname(path), { recursive: true });
  }
  appendFileSync(path, `${JSON.stringify(event)}\n`, 'utf8');
}

export function readAllEvents(): LedgerEvent[] {
  const path = ledgerFile();
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, 'utf8');
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
  return ledgerFile();
}
