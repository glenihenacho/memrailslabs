import { randomUUID } from 'node:crypto';
import { logEvent } from '@/lib/ledger/events';
import { readAllEvents } from '@/lib/ledger/jsonl';
import type {
  PaymentRail,
  PaymentSession,
  Voucher,
  VoucherResult,
} from '@/types/payments';
import { loadSession, saveSession } from './store';
import { packetCostCents } from './cost';

export class SessionNotFound extends Error {
  constructor(session_id: string) {
    super(`session_not_found: ${session_id}`);
    this.name = 'SessionNotFound';
  }
}

export class InvalidTransition extends Error {
  constructor(from: string, to: string) {
    super(`invalid_transition: ${from} -> ${to}`);
    this.name = 'InvalidTransition';
  }
}

export type AuthorizeInput = {
  budget_cents: number;
  rail: PaymentRail;
  payer_agent_id?: string;
  endpoint_id?: string;
};

export function authorizeSession(input: AuthorizeInput): PaymentSession {
  const now = new Date().toISOString();
  const session: PaymentSession = {
    session_id: `sess_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
    payer_agent_id: input.payer_agent_id,
    endpoint_id: input.endpoint_id ?? 'memrails://default',
    budget_cents: input.budget_cents,
    spent_cents: 0,
    rail: input.rail,
    status: 'authorized',
    created_at: now,
    updated_at: now,
  };
  saveSession(session);
  logEvent(
    'PAYMENT_AUTHORIZED',
    {
      session_id: session.session_id,
      rail: session.rail,
      budget_cents: session.budget_cents,
      endpoint_id: session.endpoint_id,
    },
    { session_id: session.session_id },
  );
  return session;
}

function alreadyBilled(session_id: string, packet_id: string): boolean {
  const events = readAllEvents();
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.event_type !== 'PACKET_BILLED') continue;
    if (e.session_id !== session_id) continue;
    if (e.packet_id === packet_id) return true;
  }
  return false;
}

export type BillInput = {
  session_id: string;
  packet_id: string;
};

export function billPacket(input: BillInput): VoucherResult {
  const session = loadSession(input.session_id);
  if (!session) {
    return { ok: false, reason: 'session_not_found', session_id: input.session_id };
  }
  if (session.status === 'closed') {
    return { ok: false, reason: 'session_closed', session_id: session.session_id };
  }
  if (session.status === 'exhausted') {
    return { ok: false, reason: 'session_exhausted', session_id: session.session_id };
  }

  if (alreadyBilled(session.session_id, input.packet_id)) {
    return {
      ok: true,
      session_id: session.session_id,
      packet_id: input.packet_id,
      debit_cents: 0,
      remaining_cents: session.budget_cents - session.spent_cents,
      rail: session.rail,
    };
  }

  const debit = packetCostCents();
  const remainingBefore = session.budget_cents - session.spent_cents;
  if (remainingBefore < debit) {
    session.status = 'exhausted';
    session.updated_at = new Date().toISOString();
    saveSession(session);
    return { ok: false, reason: 'insufficient_budget', session_id: session.session_id };
  }

  session.spent_cents += debit;
  session.status = session.budget_cents - session.spent_cents <= 0 ? 'exhausted' : 'active';
  session.updated_at = new Date().toISOString();
  saveSession(session);

  const remaining = session.budget_cents - session.spent_cents;
  const voucher: Voucher = {
    ok: true,
    session_id: session.session_id,
    packet_id: input.packet_id,
    debit_cents: debit,
    remaining_cents: remaining,
    rail: session.rail,
  };

  logEvent(
    'PACKET_BILLED',
    {
      session_id: session.session_id,
      packet_id: input.packet_id,
      debit_cents: debit,
      remaining_cents: remaining,
      rail: session.rail,
    },
    {
      session_id: session.session_id,
      packet_id: input.packet_id,
      cost_cents: debit,
    },
  );

  return voucher;
}

export function closeSession(session_id: string): PaymentSession {
  const session = loadSession(session_id);
  if (!session) throw new SessionNotFound(session_id);
  if (session.status === 'closed') return session;
  session.status = 'closed';
  session.updated_at = new Date().toISOString();
  saveSession(session);
  return session;
}
