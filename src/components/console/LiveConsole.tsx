'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ContextBundle, RetrievalMode } from '@/types/bundle';
import type { LedgerEvent } from '@/types/ledger';
import { calculateRetrievalCost, formatUsd } from '@/lib/pricing/calculator';

type LedgerResponse = { events: LedgerEvent[] };

const MODES: RetrievalMode[] = ['tree', 'hybrid', 'exact', 'hot', 'debug'];

export function LiveConsole() {
  const [taskContext, setTaskContext] = useState(
    'Detail the technical requirements and retrieval architecture for MemRails.',
  );
  const [mode, setMode] = useState<RetrievalMode>('tree');
  const [includeEvidence, setIncludeEvidence] = useState(false);
  const [includePacket, setIncludePacket] = useState(false);
  const [bundle, setBundle] = useState<ContextBundle | null>(null);
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshLedger = useCallback(async () => {
    try {
      const res = await fetch('/api/ledger', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as LedgerResponse;
      setEvents(data.events.reverse());
    } catch {
      // Network failure here shouldn't disturb the bundle view.
    }
  }, []);

  useEffect(() => {
    refreshLedger();
  }, [refreshLedger]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/memory/retrieve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          task_context: taskContext,
          retrieval_mode: mode,
          include_evidence: includeEvidence,
          include_packet: includePacket,
        }),
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      setBundle((await res.json()) as ContextBundle);
      refreshLedger();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const retrievalEvents = events.filter((e) => e.event_type === 'MEMORY_RETRIEVED');

  return (
    <div className="mt-12 grid lg:grid-cols-[1.05fr_1fr] gap-4">
      <div className="rounded-xl border hairline bg-graphite/40 shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-4 h-10 border-b hairline bg-graphite-2">
          <div className="text-[11px] font-mono text-muted-foreground">memory.retrieve()</div>
          <div className="text-[11px] font-mono text-signal flex items-center gap-2">
            <span className="live-dot" /> governed
          </div>
        </div>
        <form className="p-5 space-y-4" onSubmit={submit}>
          <label className="block">
            <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
              task_context
            </span>
            <textarea
              className="mt-2 w-full rounded-md border hairline bg-graphite-2/60 px-3 py-2 font-mono text-[13px] leading-relaxed focus:border-signal/60 focus:outline-none"
              rows={3}
              value={taskContext}
              onChange={(e) => setTaskContext(e.target.value)}
            />
          </label>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="block flex-1 min-w-[120px]">
              <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
                mode
              </span>
              <select
                className="mt-2 w-full rounded-md border hairline bg-graphite-2/60 px-3 py-2 font-mono text-[13px] focus:border-signal/60 focus:outline-none"
                value={mode}
                onChange={(e) => setMode(e.target.value as RetrievalMode)}
              >
                {MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-[12px] font-mono text-muted-foreground self-end mb-2">
              <input type="checkbox" checked={includeEvidence} onChange={(e) => setIncludeEvidence(e.target.checked)} />
              evidence
            </label>
            <label className="flex items-center gap-2 text-[12px] font-mono text-muted-foreground self-end mb-2">
              <input type="checkbox" checked={includePacket} onChange={(e) => setIncludePacket(e.target.checked)} />
              packet
            </label>
            <button
              type="submit"
              disabled={loading || taskContext.trim().length === 0}
              className="self-end inline-flex items-center gap-2 h-10 px-5 rounded-md bg-signal text-signal-foreground font-semibold text-[13px] shadow-signal hover:opacity-95 transition disabled:opacity-50"
            >
              {loading ? 'retrieving…' : 'retrieve →'}
            </button>
          </div>
          {error && <div className="text-[12px] font-mono text-evidence-bad">{error}</div>}
        </form>

        <div className="border-t hairline px-5 py-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-3">
            Retrieval stream &middot; {retrievalEvents.length} retrievals &middot; fee{' '}
            {formatUsd(calculateRetrievalCost(retrievalEvents.length))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px] font-mono">
              <thead className="text-muted-foreground">
                <tr className="border-b hairline">
                  <th className="py-2 pr-3 font-normal">time</th>
                  <th className="py-2 pr-3 font-normal">mode</th>
                  <th className="py-2 pr-3 font-normal">ms</th>
                  <th className="py-2 pr-3 font-normal">ret/cons</th>
                  <th className="py-2 pr-3 font-normal">tokens</th>
                </tr>
              </thead>
              <tbody>
                {retrievalEvents.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-muted-foreground">
                      No retrievals yet. Run one above.
                    </td>
                  </tr>
                )}
                {retrievalEvents.slice(0, 20).map((e) => {
                  const m = e.metadata as {
                    mode: string;
                    latency_ms: number;
                    memories_considered: number;
                    memories_returned: number;
                    tokens_returned: number;
                  };
                  return (
                    <tr key={e.event_id} className="border-b hairline align-top">
                      <td className="py-2 pr-3 text-muted-foreground">
                        {new Date(e.created_at).toLocaleTimeString()}
                      </td>
                      <td className="py-2 pr-3 text-signal">{m.mode}</td>
                      <td className="py-2 pr-3 tabular-nums">{m.latency_ms}</td>
                      <td className="py-2 pr-3 tabular-nums">
                        {m.memories_returned}/{m.memories_considered}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{m.tokens_returned}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="rounded-xl border hairline bg-graphite/40 shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-4 h-10 border-b hairline bg-graphite-2">
          <div className="text-[11px] font-mono text-muted-foreground">context bundle</div>
          {bundle && <div className="text-[11px] font-mono text-signal">{bundle.context_bundle_id}</div>}
        </div>
        {!bundle ? (
          <div className="p-8 text-[13px] text-muted-foreground">Run a retrieval to populate the bundle.</div>
        ) : (
          <div className="p-5 space-y-5 text-[13px]">
            <div className="flex flex-wrap gap-2">
              {bundle.retrieval_trace.branches_selected.map((b) => (
                <span
                  key={b}
                  className="px-2 py-1 rounded border hairline bg-graphite-2/60 font-mono text-[11px] text-cyan"
                >
                  {b}
                </span>
              ))}
            </div>

            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-2">
                Memories ({bundle.memories.length}) &middot; {bundle.tokens_returned}/{bundle.token_budget} tokens
              </div>
              <ul className="space-y-3 font-mono text-[12px]">
                {bundle.memories.map((m) => (
                  <li key={m.memory_id} className="border-b hairline pb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-signal">{m.memory_id}</span>
                      <span className="flex items-center gap-2">
                        <StatusDot status={m.status} />
                        <span className="tabular-nums text-evidence-good">
                          {(m.confidence * 100).toFixed(0)}%
                        </span>
                        <span className="tabular-nums text-muted-foreground">score {m.score.toFixed(2)}</span>
                      </span>
                    </div>
                    <p className="mt-1 text-foreground/90 leading-relaxed">{m.summary}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground italic">{m.reason_selected}</p>
                  </li>
                ))}
              </ul>
            </div>

            {bundle.omitted.length > 0 && (
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-2">
                  Omitted ({bundle.omitted.length})
                </div>
                <ul className="space-y-1 font-mono text-[11px] text-muted-foreground">
                  {bundle.omitted.map((o) => (
                    <li key={o.memory_id} className="flex gap-2">
                      <span className="text-evidence-warn">{o.memory_id}</span>
                      <span>— {o.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-[11.5px] font-mono">
              <Meta label="mode" value={bundle.mode} />
              <Meta label="candidates" value={String(bundle.retrieval_trace.candidates_considered)} />
              <Meta label="roots visited" value={String(bundle.retrieval_trace.root_nodes_visited)} />
              <Meta label="latency" value={`${bundle.latency_ms}ms`} />
            </div>
            <div className="text-[10px] font-mono text-muted-foreground">
              policy: {bundle.retrieval_trace.policy_filters_applied.join(' · ')}
            </div>

            <div className="flex items-center justify-between rounded-md border hairline bg-graphite-2/60 px-3 py-2 font-mono text-[11px]">
              <span className="text-muted-foreground">
                billable: <span className="text-signal">{bundle.usage.billable_retrievals}</span> retrieval
                {bundle.usage.billable_units !== 1 ? ` · ${bundle.usage.billable_units}u` : ''}
              </span>
              <span className={bundle.usage.credit_exhausted ? 'text-evidence-bad' : 'text-evidence-good'}>
                {Number.isFinite(bundle.usage.credits_remaining)
                  ? `${bundle.usage.credits_remaining} credits left`
                  : 'usage billing'}
              </span>
            </div>

            {bundle.packet && (
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-2">
                  Synthesized packet ({bundle.packet.tokens} tokens · {bundle.packet.model_or_compressor})
                </div>
                <pre className="font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-foreground/90">
{bundle.packet.packet}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'active'
      ? 'var(--evidence-good)'
      : status === 'disputed'
        ? 'var(--evidence-warn)'
        : 'var(--evidence-bad)';
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {status}
    </span>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
