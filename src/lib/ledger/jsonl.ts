import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { LedgerEvent } from '@/types/ledger';

/**
 * The append-only ledger lives at `data/logs/ledger.jsonl` by default.
 * Override via `MEMRAILS_LEDGER_PATH` so tests can route to a temp file and
 * self-host deployments can relocate logs (§5 console, §7 no lock-in).
 * Resolved per call so each read/write sees the current env.
 */
function ledgerFile(): string {
  const override = process.env.MEMRAILS_LEDGER_PATH;
  return override ? resolve(override) : resolve(process.cwd(), 'data', 'logs', 'ledger.jsonl');
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
