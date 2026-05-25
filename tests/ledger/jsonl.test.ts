import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, appendFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let workdir: string;
const originalCwd = process.cwd();

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'memrails-ledger-'));
  mkdirSync(join(workdir, 'data', 'logs'), { recursive: true });
  process.chdir(workdir);
  vi.resetModules();
});

afterEach(() => {
  process.chdir(originalCwd);
  if (existsSync(workdir)) rmSync(workdir, { recursive: true, force: true });
});

async function freshJsonl() {
  return (await import('@/lib/ledger/jsonl')) as typeof import('@/lib/ledger/jsonl');
}

describe('ledger jsonl', () => {
  it('round-trips appended events', async () => {
    const { appendEvent, readAllEvents } = await freshJsonl();
    appendEvent({
      event_id: 'evt_one',
      event_type: 'QUERY',
      metadata: { query: 'a' },
      created_at: '2026-05-25T00:00:00.000Z',
    });
    appendEvent({
      event_id: 'evt_two',
      event_type: 'PACKET_CREATED',
      metadata: { tokens: 42 },
      created_at: '2026-05-25T00:00:01.000Z',
    });
    const events = readAllEvents();
    expect(events).toHaveLength(2);
    expect(events[0].event_id).toBe('evt_one');
    expect(events[1].metadata.tokens).toBe(42);
  });

  it('returns [] when the ledger file is missing', async () => {
    const { readAllEvents } = await freshJsonl();
    expect(readAllEvents()).toEqual([]);
  });

  it('skips malformed lines without throwing', async () => {
    const { appendEvent, readAllEvents, ledgerPath } = await freshJsonl();
    appendEvent({
      event_id: 'evt_ok',
      event_type: 'QUERY',
      metadata: {},
      created_at: '2026-05-25T00:00:00.000Z',
    });
    appendFileSync(ledgerPath(), 'not-valid-json\n', 'utf8');
    appendEvent({
      event_id: 'evt_ok_two',
      event_type: 'QUERY',
      metadata: {},
      created_at: '2026-05-25T00:00:02.000Z',
    });
    const events = readAllEvents();
    expect(events.map((e) => e.event_id)).toEqual(['evt_ok', 'evt_ok_two']);
  });
});
