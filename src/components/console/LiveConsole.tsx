'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MemoryPacket } from '@/types/packet';
import type { LedgerEvent } from '@/types/ledger';
import { calculateOrchestrationCost, formatUsd } from '@/lib/pricing/calculator';
import { RefactorFeed } from './RefactorFeed';
import { BillingPanel } from './BillingPanel';

type LedgerResponse = { events: LedgerEvent[] };

export function LiveConsole() {
  const [query, setQuery] = useState('what is the packet contract?');
  const [intent, setIntent] = useState<MemoryPacket['intent']>('answer');
  const [packet, setPacket] = useState<MemoryPacket | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [billAgainstSession, setBillAgainstSession] = useState(false);

  const refreshLedger = useCallback(async () => {
    try {
      const res = await fetch('/api/ledger', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as LedgerResponse;
      setEvents(data.events.reverse());
    } catch {
      // Network failure here shouldn't disturb the query view.
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
      const body: { query: string; intent: MemoryPacket['intent']; session_id?: string } = {
        query,
        intent,
      };
      if (billAgainstSession && selectedSessionId) {
        body.session_id = selectedSessionId;
      }
      const res = await fetch('/api/memory/query', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 402) {
        const errBody = (await res.json()) as { reason: string; session_id: string };
        throw new Error(`402 payment_required: ${errBody.reason} (${errBody.session_id})`);
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as MemoryPacket;
      setPacket(data);
      setSelectedId(data.packet_id);
      refreshLedger();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const loadPast = async (packetId: string) => {
    setSelectedId(packetId);
    setError(null);
    try {
      const res = await fetch(`/api/memory/packet/${packetId}`, { cache: 'no-store' });
      if (!res.ok) {
        setError(`packet ${packetId} not found in store`);
        return;
      }
      const data = (await res.json()) as MemoryPacket;
      setPacket(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const queryEvents = events.filter((e) => e.event_type === 'PACKET_CREATED');
  const packetCount = queryEvents.length;

  return (
    <>
    <div className="mt-12 grid lg:grid-cols-[1.1fr_1fr] gap-4">
      <div className="rounded-xl border hairline bg-graphite/40 shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-4 h-10 border-b hairline bg-graphite-2">
          <div className="text-[11px] font-mono text-muted-foreground">memory.query()</div>
          <div className="text-[11px] font-mono text-signal flex items-center gap-2">
            <span className="live-dot" /> live
          </div>
        </div>
        <form className="p-5 space-y-4" onSubmit={submit}>
          <label className="block">
            <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
              query
            </span>
            <textarea
              className="mt-2 w-full rounded-md border hairline bg-graphite-2/60 px-3 py-2 font-mono text-[13px] leading-relaxed focus:border-signal/60 focus:outline-none"
              rows={3}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="flex items-center gap-3">
            <label className="block flex-1">
              <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
                intent
              </span>
              <select
                className="mt-2 w-full rounded-md border hairline bg-graphite-2/60 px-3 py-2 font-mono text-[13px] focus:border-signal/60 focus:outline-none"
                value={intent}
                onChange={(e) => setIntent(e.target.value as MemoryPacket['intent'])}
              >
                <option value="answer">answer</option>
                <option value="summarize">summarize</option>
                <option value="compare">compare</option>
                <option value="extract">extract</option>
                <option value="route">route</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={loading || query.trim().length === 0}
              className="self-end inline-flex items-center gap-2 h-10 px-5 rounded-md bg-signal text-signal-foreground font-semibold text-[13px] shadow-signal hover:opacity-95 transition disabled:opacity-50"
            >
              {loading ? 'querying…' : 'run query →'}
            </button>
          </div>
          <label className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
            <input
              type="checkbox"
              checked={billAgainstSession}
              onChange={(e) => setBillAgainstSession(e.target.checked)}
              disabled={!selectedSessionId}
            />
            <span>
              bill against session{' '}
              <span className="text-signal">
                {selectedSessionId ?? '— select one below'}
              </span>
            </span>
          </label>
          {error && (
            <div className="text-[12px] font-mono text-evidence-bad">{error}</div>
          )}
        </form>

        <div className="border-t hairline px-5 py-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-3">
            Query stream &middot; {queryEvents.length} packets &middot; orchestration{' '}
            {formatUsd(calculateOrchestrationCost(packetCount))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px] font-mono">
              <thead className="text-muted-foreground">
                <tr className="border-b hairline">
                  <th className="py-2 pr-3 font-normal">time</th>
                  <th className="py-2 pr-3 font-normal">layer</th>
                  <th className="py-2 pr-3 font-normal">ms</th>
                  <th className="py-2 pr-3 font-normal">tokens</th>
                  <th className="py-2 pr-3 font-normal">conf</th>
                  <th className="py-2 pr-3 font-normal">query</th>
                </tr>
              </thead>
              <tbody>
                {queryEvents.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-muted-foreground">
                      No packets yet. Submit a query above.
                    </td>
                  </tr>
                )}
                {queryEvents.slice(0, 20).map((e) => {
                  const m = e.metadata as {
                    query: string;
                    layer: string;
                    tokens: number;
                    confidence: number;
                    latency_ms: number;
                  };
                  const isSelected = e.packet_id === selectedId;
                  return (
                    <tr
                      key={e.event_id}
                      onClick={() => e.packet_id && loadPast(e.packet_id)}
                      className={`border-b hairline align-top cursor-pointer hover:bg-graphite-2/40 transition ${
                        isSelected ? 'bg-graphite-2/60 border-l-2 border-l-signal' : ''
                      }`}
                    >
                      <td className="py-2 pr-3 text-muted-foreground">
                        {new Date(e.created_at).toLocaleTimeString()}
                      </td>
                      <td className="py-2 pr-3 text-signal">{m.layer}</td>
                      <td className="py-2 pr-3 tabular-nums">{m.latency_ms}</td>
                      <td className="py-2 pr-3 tabular-nums">{m.tokens}</td>
                      <td className="py-2 pr-3 tabular-nums">{m.confidence?.toFixed?.(2)}</td>
                      <td className="py-2 pr-3 text-muted-foreground truncate max-w-[24ch]">
                        {m.query}
                      </td>
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
          <div className="text-[11px] font-mono text-muted-foreground">packet inspector</div>
          {packet && (
            <div className="text-[11px] font-mono text-signal">{packet.packet_id}</div>
          )}
        </div>
        {!packet ? (
          <div className="p-8 text-[13px] text-muted-foreground">
            Run a query, or click a past packet in the stream to inspect it.
          </div>
        ) : (
          <div className="p-5 space-y-5 text-[13px]">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-2">
                Packet
              </div>
              <pre className="font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-foreground">
{packet.packet}
              </pre>
            </div>
            <div className="grid grid-cols-2 gap-3 text-[11.5px] font-mono">
              <Meta label="layer" value={packet.resolved_layer} />
              <Meta label="intent" value={packet.intent} />
              <Meta label="tokens" value={String(packet.tokens)} />
              <Meta label="confidence" value={packet.confidence.toFixed(3)} />
              <Meta label="contradictions" value={String(packet.contradictions_surfaced)} />
              <Meta label="compressor" value={packet.model_or_compressor} />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-2">
                Evidence ({packet.evidence.length})
              </div>
              <ul className="space-y-2 font-mono text-[12px]">
                {packet.evidence.map((ev) => (
                  <li
                    key={ev.claim_id}
                    className="flex items-center justify-between border-b hairline pb-2"
                  >
                    <span className="text-signal">{ev.claim_id}</span>
                    <span className="text-muted-foreground">{ev.source_file}</span>
                    <span className="tabular-nums text-evidence-good">
                      {(ev.weight * 100).toFixed(0)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-1 gap-2 text-[11px] font-mono">
              <Meta label="input_hash" value={packet.input_hash} mono />
              <Meta label="output_hash" value={packet.output_hash} mono />
            </div>
          </div>
        )}
      </div>
    </div>
    <BillingPanel
      events={events}
      selectedSessionId={selectedSessionId}
      onSelectSession={(id) => {
        setSelectedSessionId(id);
        if (id) setBillAgainstSession(true);
      }}
    />
    <RefactorFeed />
    </>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <span className={mono ? 'truncate text-foreground' : 'text-foreground'}>{value}</span>
    </div>
  );
}
