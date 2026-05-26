import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let workdir: string;
const originalCwd = process.cwd();

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'memrails-query-billing-'));
  cpSync(join(originalCwd, 'knowledge'), join(workdir, 'knowledge'), { recursive: true });
  mkdirSync(join(workdir, 'data', 'logs'), { recursive: true });
  mkdirSync(join(workdir, 'data', 'packets'), { recursive: true });
  mkdirSync(join(workdir, 'data', 'sessions'), { recursive: true });
  process.chdir(workdir);
  vi.resetModules();
});

afterEach(() => {
  process.chdir(originalCwd);
  if (existsSync(workdir)) rmSync(workdir, { recursive: true, force: true });
});

async function freshMemory() {
  return (await import('@/lib/memory')) as typeof import('@/lib/memory');
}
async function freshSessions() {
  return (await import('@/lib/payments/sessions')) as typeof import('@/lib/payments/sessions');
}
async function freshLedger() {
  return (await import('@/lib/ledger/jsonl')) as typeof import('@/lib/ledger/jsonl');
}

describe('query() with session_id', () => {
  it('debits the session and writes both PACKET_CREATED and PACKET_BILLED', async () => {
    const { query } = await freshMemory();
    const { authorizeSession } = await freshSessions();
    const { readAllEvents } = await freshLedger();

    const session = authorizeSession({ budget_cents: 5, rail: 'stripe_card' });
    const packet = await query({
      query: 'what is the packet contract?',
      session_id: session.session_id,
    });
    expect(packet.packet_id).toMatch(/^pkt_/);

    const events = readAllEvents();
    const created = events.find(
      (e) => e.event_type === 'PACKET_CREATED' && e.packet_id === packet.packet_id,
    );
    expect(created).toBeDefined();
    expect(created?.cost_cents).toBeCloseTo(0.05, 10);
    expect(created?.session_id).toBe(session.session_id);

    const billed = events.find(
      (e) => e.event_type === 'PACKET_BILLED' && e.packet_id === packet.packet_id,
    );
    expect(billed).toBeDefined();
    expect(billed?.session_id).toBe(session.session_id);
    expect(billed?.metadata.debit_cents).toBeCloseTo(0.05, 10);
    expect(billed?.metadata.remaining_cents).toBeCloseTo(4.95, 10);
  });

  it('throws PaymentRequired when the session is exhausted', async () => {
    const { query, PaymentRequired } = await freshMemory();
    const { authorizeSession } = await freshSessions();
    const { readAllEvents } = await freshLedger();

    const session = authorizeSession({ budget_cents: 0.04, rail: 'usdc_tempo' });
    await expect(
      query({ query: 'what is the packet contract?', session_id: session.session_id }),
    ).rejects.toBeInstanceOf(PaymentRequired);

    const billed = readAllEvents().filter((e) => e.event_type === 'PACKET_BILLED');
    expect(billed).toHaveLength(0);
  });
});

describe('query() without session_id (regression)', () => {
  it('produces no PACKET_BILLED events and no cost_cents on PACKET_CREATED', async () => {
    const { query } = await freshMemory();
    const { readAllEvents } = await freshLedger();
    const packet = await query({ query: 'what is the packet contract?' });
    const events = readAllEvents();
    const created = events.find(
      (e) => e.event_type === 'PACKET_CREATED' && e.packet_id === packet.packet_id,
    );
    expect(created?.cost_cents).toBeUndefined();
    expect(created?.session_id).toBeUndefined();
    expect(events.find((e) => e.event_type === 'PACKET_BILLED')).toBeUndefined();
  });
});
