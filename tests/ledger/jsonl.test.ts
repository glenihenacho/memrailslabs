import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendEvent, readAllEvents, ledgerPath } from '@/lib/ledger/jsonl';
import type { LedgerEvent } from '@/types/ledger';

function event(id: string): LedgerEvent {
  return {
    event_id: id,
    event_type: 'QUERY',
    metadata: { query: 'q' },
    created_at: '2026-05-25T00:00:00.000Z',
  };
}

describe('jsonl ledger', () => {
  beforeEach(() => {
    const dir = mkdtempSync(join(tmpdir(), 'memrails-jsonl-'));
    process.env.MEMRAILS_LEDGER_PATH = join(dir, 'ledger.jsonl');
  });

  it('returns an empty array when no ledger file exists yet', () => {
    expect(readAllEvents()).toEqual([]);
  });

  it('round-trips appended events in order', () => {
    appendEvent(event('evt_1'));
    appendEvent(event('evt_2'));
    const ids = readAllEvents().map((e) => e.event_id);
    expect(ids).toEqual(['evt_1', 'evt_2']);
  });

  it('skips malformed lines without throwing', () => {
    appendEvent(event('evt_1'));
    appendFileSync(ledgerPath(), 'not-json\n', 'utf8');
    appendEvent(event('evt_2'));
    const ids = readAllEvents().map((e) => e.event_id);
    expect(ids).toEqual(['evt_1', 'evt_2']);
  });
});
