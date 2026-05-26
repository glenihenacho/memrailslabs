import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let workdir: string;
const originalCwd = process.cwd();

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'memrails-sessions-'));
  mkdirSync(join(workdir, 'data', 'logs'), { recursive: true });
  mkdirSync(join(workdir, 'data', 'sessions'), { recursive: true });
  process.chdir(workdir);
  vi.resetModules();
});

afterEach(() => {
  process.chdir(originalCwd);
  if (existsSync(workdir)) rmSync(workdir, { recursive: true, force: true });
});

async function freshSessions() {
  return (await import('@/lib/payments/sessions')) as typeof import('@/lib/payments/sessions');
}

async function freshStore() {
  return (await import('@/lib/payments/store')) as typeof import('@/lib/payments/store');
}

async function freshLedger() {
  return (await import('@/lib/ledger/jsonl')) as typeof import('@/lib/ledger/jsonl');
}

describe('authorizeSession', () => {
  it('persists a session with status authorized and logs PAYMENT_AUTHORIZED', async () => {
    const { authorizeSession } = await freshSessions();
    const { loadSession } = await freshStore();
    const { readAllEvents } = await freshLedger();

    const session = authorizeSession({ budget_cents: 200, rail: 'stripe_card' });
    expect(session.session_id).toMatch(/^sess_[a-z0-9]{6,32}$/);
    expect(session.status).toBe('authorized');
    expect(session.budget_cents).toBe(200);
    expect(session.spent_cents).toBe(0);
    expect(loadSession(session.session_id)).not.toBeNull();

    const events = readAllEvents();
    const authEvent = events.find(
      (e) => e.event_type === 'PAYMENT_AUTHORIZED' && e.session_id === session.session_id,
    );
    expect(authEvent).toBeDefined();
    expect(authEvent?.metadata.rail).toBe('stripe_card');
  });
});

describe('billPacket', () => {
  it('debits the session and emits PACKET_BILLED', async () => {
    const { authorizeSession, billPacket } = await freshSessions();
    const { readAllEvents } = await freshLedger();

    const session = authorizeSession({ budget_cents: 1, rail: 'usdc_tempo' });
    const voucher = billPacket({ session_id: session.session_id, packet_id: 'pkt_a' });
    expect(voucher.ok).toBe(true);
    if (!voucher.ok) return;
    expect(voucher.debit_cents).toBeCloseTo(0.05, 10);
    expect(voucher.remaining_cents).toBeCloseTo(0.95, 10);

    const billed = readAllEvents().filter((e) => e.event_type === 'PACKET_BILLED');
    expect(billed).toHaveLength(1);
    expect(billed[0].session_id).toBe(session.session_id);
    expect(billed[0].packet_id).toBe('pkt_a');
    expect(billed[0].cost_cents).toBeCloseTo(0.05, 10);
  });

  it('is idempotent on duplicate packet_id', async () => {
    const { authorizeSession, billPacket } = await freshSessions();
    const { readAllEvents } = await freshLedger();
    const { loadSession } = await freshStore();

    const session = authorizeSession({ budget_cents: 1, rail: 'lightning' });
    billPacket({ session_id: session.session_id, packet_id: 'pkt_dupe' });
    const second = billPacket({ session_id: session.session_id, packet_id: 'pkt_dupe' });
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.debit_cents).toBe(0);

    const billed = readAllEvents().filter((e) => e.event_type === 'PACKET_BILLED');
    expect(billed).toHaveLength(1);
    const reloaded = loadSession(session.session_id);
    expect(reloaded?.spent_cents).toBeCloseTo(0.05, 10);
  });

  it('exhausts and refuses once remaining drops below the per-packet cost', async () => {
    const { authorizeSession, billPacket } = await freshSessions();
    const { loadSession } = await freshStore();

    const session = authorizeSession({ budget_cents: 0.05, rail: 'visa' });
    const first = billPacket({ session_id: session.session_id, packet_id: 'pkt_1' });
    expect(first.ok).toBe(true);
    expect(loadSession(session.session_id)?.status).toBe('exhausted');

    const second = billPacket({ session_id: session.session_id, packet_id: 'pkt_2' });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe('session_exhausted');
  });

  it('returns session_not_found for an unknown id', async () => {
    const { billPacket } = await freshSessions();
    const result = billPacket({ session_id: 'sess_doesnotexist', packet_id: 'pkt_x' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('session_not_found');
  });

  it('returns session_not_found for a malformed id (path traversal guard)', async () => {
    const { billPacket } = await freshSessions();
    const result = billPacket({ session_id: '../etc/passwd', packet_id: 'pkt_x' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('session_not_found');
  });
});

describe('closeSession', () => {
  it('flips status to closed and blocks subsequent debits', async () => {
    const { authorizeSession, billPacket, closeSession } = await freshSessions();
    const session = authorizeSession({ budget_cents: 5, rail: 'custom' });
    const closed = closeSession(session.session_id);
    expect(closed.status).toBe('closed');

    const billed = billPacket({ session_id: session.session_id, packet_id: 'pkt_z' });
    expect(billed.ok).toBe(false);
    if (!billed.ok) expect(billed.reason).toBe('session_closed');
  });

  it('is idempotent on a closed session', async () => {
    const { authorizeSession, closeSession } = await freshSessions();
    const session = authorizeSession({ budget_cents: 5, rail: 'custom' });
    closeSession(session.session_id);
    const second = closeSession(session.session_id);
    expect(second.status).toBe('closed');
  });

  it('throws SessionNotFound on unknown id', async () => {
    const { closeSession, SessionNotFound } = await freshSessions();
    expect(() => closeSession('sess_missing')).toThrow(SessionNotFound);
  });
});

describe('listSessions', () => {
  it('returns sessions in newest-first order', async () => {
    const { authorizeSession } = await freshSessions();
    const { listSessions } = await freshStore();
    const a = authorizeSession({ budget_cents: 1, rail: 'stripe_card' });
    await new Promise((r) => setTimeout(r, 5));
    const b = authorizeSession({ budget_cents: 2, rail: 'usdc_tempo' });
    const ids = listSessions().map((s) => s.session_id);
    expect(ids[0]).toBe(b.session_id);
    expect(ids).toContain(a.session_id);
  });
});
