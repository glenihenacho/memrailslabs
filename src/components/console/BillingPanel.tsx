'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LedgerEvent } from '@/types/ledger';
import type { PaymentRail, PaymentSession, SessionStatus } from '@/types/payments';
import { formatUsd } from '@/lib/pricing/calculator';

type SessionWithRemaining = PaymentSession & { remaining_cents: number };

type Props = {
  events: LedgerEvent[];
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string | null) => void;
};

const RAILS: PaymentRail[] = [
  'usdc_tempo',
  'stripe_card',
  'visa',
  'lightning',
  'custom',
];

export function BillingPanel({ events, selectedSessionId, onSelectSession }: Props) {
  const [sessions, setSessions] = useState<SessionWithRemaining[]>([]);
  const [budgetDollars, setBudgetDollars] = useState('2.00');
  const [rail, setRail] = useState<PaymentRail>('stripe_card');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions', { cache: 'no-store' });
      if (!res.ok) return;
      const body = (await res.json()) as { sessions: SessionWithRemaining[] };
      setSessions(body.sessions);
    } catch {
      // Network failure is non-fatal here.
    }
  }, []);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions, events.length]);

  const billedEvents = useMemo(
    () => events.filter((e) => e.event_type === 'PACKET_BILLED'),
    [events],
  );

  const totalBilledCents = useMemo(
    () =>
      billedEvents.reduce(
        (sum, e) => sum + (typeof e.cost_cents === 'number' ? e.cost_cents : 0),
        0,
      ),
    [billedEvents],
  );

  const activeCount = sessions.filter(
    (s) => s.status === 'authorized' || s.status === 'active',
  ).length;

  const selectedSession = sessions.find((s) => s.session_id === selectedSessionId) ?? null;
  const sessionVouchers = selectedSession
    ? billedEvents.filter((e) => e.session_id === selectedSession.session_id)
    : [];

  const submitAuthorize = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const cents = Math.round(parseFloat(budgetDollars) * 100);
      if (!Number.isFinite(cents) || cents <= 0) {
        throw new Error('budget must be a positive dollar amount');
      }
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ budget_cents: cents, rail }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const created = (await res.json()) as SessionWithRemaining;
      await refreshSessions();
      onSelectSession(created.session_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const closeSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/close`, { method: 'POST' });
      if (!res.ok) return;
      refreshSessions();
    } catch {
      // ignore
    }
  };

  return (
    <div className="mt-6 rounded-xl border hairline bg-graphite/40 shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-4 h-10 border-b hairline bg-graphite-2">
        <div className="text-[11px] font-mono text-muted-foreground">
          billing ledger &middot; sessions &amp; vouchers
        </div>
        <a
          href="/api/ledger?format=jsonl"
          download="memrails-ledger.jsonl"
          className="text-[11px] font-mono text-cyan hover:text-signal transition"
        >
          export ledger as JSONL ↓
        </a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-5 py-4 border-b hairline">
        <Stat label="active sessions" value={String(activeCount)} />
        <Stat label="total sessions" value={String(sessions.length)} />
        <Stat label="packets billed" value={String(billedEvents.length)} />
        <Stat
          label="total billed"
          value={formatUsd(totalBilledCents / 100)}
          tone="signal"
        />
      </div>

      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-0">
        <div className="p-5 border-b lg:border-b-0 lg:border-r hairline">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-3">
            Authorize session
          </div>
          <form onSubmit={submitAuthorize} className="space-y-3">
            <label className="block">
              <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
                budget (USD)
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={budgetDollars}
                onChange={(e) => setBudgetDollars(e.target.value)}
                className="mt-2 w-full rounded-md border hairline bg-graphite-2/60 px-3 py-2 font-mono text-[13px] focus:border-signal/60 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
                rail
              </span>
              <select
                value={rail}
                onChange={(e) => setRail(e.target.value as PaymentRail)}
                className="mt-2 w-full rounded-md border hairline bg-graphite-2/60 px-3 py-2 font-mono text-[13px] focus:border-signal/60 focus:outline-none"
              >
                {RAILS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-signal text-signal-foreground font-semibold text-[12px] shadow-signal hover:opacity-95 transition disabled:opacity-50"
            >
              {submitting ? 'authorizing…' : 'authorize →'}
            </button>
            {error && (
              <div className="text-[12px] font-mono text-evidence-bad">{error}</div>
            )}
          </form>

          <div className="mt-6">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-2">
              Sessions ({sessions.length})
            </div>
            {sessions.length === 0 && (
              <div className="text-[12px] text-muted-foreground">
                None yet. Authorize one to start billing packets.
              </div>
            )}
            <ul className="space-y-2 font-mono text-[12px]">
              {sessions.map((s) => {
                const isSelected = s.session_id === selectedSessionId;
                return (
                  <li
                    key={s.session_id}
                    onClick={() => onSelectSession(s.session_id)}
                    className={`cursor-pointer rounded-md border hairline px-3 py-2 hover:border-signal/60 transition ${
                      isSelected ? 'border-l-2 border-l-signal bg-graphite-2/60' : ''
                    }`}
                  >
                    <div className="flex justify-between items-baseline gap-3">
                      <span className="text-signal truncate">{s.session_id}</span>
                      <StatusBadge status={s.status} />
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1 flex justify-between gap-3">
                      <span>{s.rail}</span>
                      <span className="tabular-nums">
                        {formatUsd(s.remaining_cents / 100)} / {formatUsd(s.budget_cents / 100)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="p-5">
          {!selectedSession ? (
            <div className="text-[13px] text-muted-foreground">
              Select a session to inspect its voucher trail, or authorize a new one.
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-4 mb-4">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                    Selected session
                  </div>
                  <div className="font-mono text-[14px] text-signal mt-1">
                    {selectedSession.session_id}
                  </div>
                </div>
                {(selectedSession.status === 'authorized' ||
                  selectedSession.status === 'active') && (
                  <button
                    type="button"
                    onClick={() => closeSession(selectedSession.session_id)}
                    className="text-[11px] font-mono text-evidence-bad hover:text-signal transition"
                  >
                    close session
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11.5px] font-mono mb-5">
                <Meta label="rail" value={selectedSession.rail} />
                <Meta label="status" value={selectedSession.status} />
                <Meta
                  label="budget"
                  value={formatUsd(selectedSession.budget_cents / 100)}
                />
                <Meta
                  label="remaining"
                  value={formatUsd(selectedSession.remaining_cents / 100)}
                />
              </div>

              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-2">
                Vouchers ({sessionVouchers.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px] font-mono">
                  <thead className="text-muted-foreground">
                    <tr className="border-b hairline">
                      <th className="py-2 pr-3 font-normal">time</th>
                      <th className="py-2 pr-3 font-normal">packet</th>
                      <th className="py-2 pr-3 font-normal text-right">debit</th>
                      <th className="py-2 pr-3 font-normal text-right">remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionVouchers.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-6 text-muted-foreground">
                          No packets billed against this session yet.
                        </td>
                      </tr>
                    )}
                    {sessionVouchers.slice(0, 20).map((e) => {
                      const m = e.metadata as {
                        debit_cents: number;
                        remaining_cents: number;
                      };
                      return (
                        <tr key={e.event_id} className="border-b hairline">
                          <td className="py-2 pr-3 text-muted-foreground">
                            {new Date(e.created_at).toLocaleTimeString()}
                          </td>
                          <td className="py-2 pr-3 text-signal truncate max-w-[22ch]">
                            {e.packet_id}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-evidence-good">
                            {formatUsd(m.debit_cents / 100)}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                            {formatUsd(m.remaining_cents / 100)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'signal';
}) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 font-display text-2xl tracking-tight ${
          tone === 'signal' ? 'text-signal' : ''
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: SessionStatus }) {
  const tone =
    status === 'authorized'
      ? 'text-cyan'
      : status === 'active'
        ? 'text-evidence-good'
        : status === 'exhausted'
          ? 'text-evidence-warn'
          : 'text-evidence-bad';
  return (
    <span className={`text-[10px] uppercase tracking-[0.18em] ${tone}`}>{status}</span>
  );
}
