'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LedgerEvent } from '@/types/ledger';
import type { Endpoint, EndpointStatus } from '@/types/endpoint';

type Props = {
  events: LedgerEvent[];
  selectedEndpointId: string | null;
  onSelectEndpoint: (endpointId: string | null) => void;
};

export function HarnessPanel({ events, selectedEndpointId, onSelectEndpoint }: Props) {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [corpusPath, setCorpusPath] = useState('knowledge/');
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/endpoints', { cache: 'no-store' });
      if (!res.ok) return;
      const body = (await res.json()) as { endpoints: Endpoint[] };
      setEndpoints(body.endpoints);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, events.length]);

  const liveCount = endpoints.filter((e) => e.status === 'live').length;
  const totalIntegrations = endpoints.reduce(
    (sum, e) => sum + e.integrations.filter((i) => i.prewired).length,
    0,
  );

  const selected = endpoints.find((e) => e.endpoint_id === selectedEndpointId) ?? null;

  const endpointPackets = useMemo(
    () =>
      selected
        ? events.filter(
            (e) => e.event_type === 'PACKET_CREATED' && e.endpoint_id === selected.endpoint_id,
          )
        : [],
    [events, selected],
  );

  const submitDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeploying(true);
    setError(null);
    try {
      const res = await fetch('/api/endpoints', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ corpus_path: corpusPath.trim() || 'knowledge/' }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const ep = (await res.json()) as Endpoint;
      await refresh();
      onSelectEndpoint(ep.endpoint_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeploying(false);
    }
  };

  const close = async (endpointId: string) => {
    try {
      const res = await fetch(`/api/endpoints/${endpointId}/close`, { method: 'POST' });
      if (res.ok) refresh();
    } catch {
      // ignore
    }
  };

  return (
    <div className="mt-6 rounded-xl border hairline bg-graphite/40 shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-4 h-10 border-b hairline bg-graphite-2">
        <div className="text-[11px] font-mono text-muted-foreground">
          managed harness &middot; endpoints &amp; deploy log
        </div>
        <a
          href="/harness"
          className="text-[11px] font-mono text-cyan hover:text-signal transition"
        >
          view harness docs →
        </a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-5 py-4 border-b hairline">
        <Stat label="endpoints" value={String(endpoints.length)} />
        <Stat label="live" value={String(liveCount)} tone="signal" />
        <Stat label="prewired integrations" value={String(totalIntegrations)} />
        <Stat
          label="packets routed"
          value={String(
            events.filter(
              (e) => e.event_type === 'PACKET_CREATED' && typeof e.endpoint_id === 'string',
            ).length,
          )}
        />
      </div>

      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-0">
        <div className="p-5 border-b lg:border-b-0 lg:border-r hairline">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-3">
            Deploy endpoint
          </div>
          <form onSubmit={submitDeploy} className="space-y-3">
            <label className="block">
              <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
                corpus path
              </span>
              <input
                type="text"
                value={corpusPath}
                onChange={(e) => setCorpusPath(e.target.value)}
                className="mt-2 w-full rounded-md border hairline bg-graphite-2/60 px-3 py-2 font-mono text-[13px] focus:border-signal/60 focus:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={deploying}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-signal text-signal-foreground font-semibold text-[12px] shadow-signal hover:opacity-95 transition disabled:opacity-50"
            >
              {deploying ? 'deploying…' : 'deploy →'}
            </button>
            {error && (
              <div className="text-[12px] font-mono text-evidence-bad">{error}</div>
            )}
          </form>

          <div className="mt-6">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-2">
              Endpoints ({endpoints.length})
            </div>
            {endpoints.length === 0 && (
              <div className="text-[12px] text-muted-foreground">
                None yet. Run the deploy ceremony to mint one.
              </div>
            )}
            <ul className="space-y-2 font-mono text-[12px]">
              {endpoints.map((ep) => {
                const isSelected = ep.endpoint_id === selectedEndpointId;
                return (
                  <li
                    key={ep.endpoint_id}
                    onClick={() => onSelectEndpoint(ep.endpoint_id)}
                    className={`cursor-pointer rounded-md border hairline px-3 py-2 hover:border-signal/60 transition ${
                      isSelected ? 'border-l-2 border-l-signal bg-graphite-2/60' : ''
                    }`}
                  >
                    <div className="flex justify-between items-baseline gap-3">
                      <span className="text-signal truncate">{ep.endpoint_id}</span>
                      <EndpointStatusBadge status={ep.status} />
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1 flex justify-between gap-3">
                      <span className="truncate">{ep.url}</span>
                      <span className="tabular-nums whitespace-nowrap">
                        {ep.corpus_keys} keys
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="p-5">
          {!selected ? (
            <div className="text-[13px] text-muted-foreground">
              Select an endpoint to inspect its deploy timeline, integrations, and the
              packets routed through it.
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-4 mb-4">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                    Selected endpoint
                  </div>
                  <div className="font-mono text-[14px] text-signal mt-1">
                    {selected.endpoint_id}
                  </div>
                  <div className="font-mono text-[11px] text-cyan mt-1 break-all">
                    {selected.url}
                  </div>
                </div>
                {(selected.status === 'provisioning' || selected.status === 'live') && (
                  <button
                    type="button"
                    onClick={() => close(selected.endpoint_id)}
                    className="text-[11px] font-mono text-evidence-bad hover:text-signal transition"
                  >
                    close endpoint
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11.5px] font-mono mb-5">
                <Meta label="status" value={selected.status} />
                <Meta label="compressor" value={selected.compressor} />
                <Meta label="corpus_keys" value={String(selected.corpus_keys)} />
                <Meta
                  label="max_tokens"
                  value={String(selected.config.compress.max_tokens)}
                />
              </div>

              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-2">
                Integrations
              </div>
              <div className="flex flex-wrap gap-2 mb-5">
                {selected.integrations.map((i) => (
                  <span
                    key={i.id}
                    className={`inline-flex items-center gap-1 h-7 px-3 rounded-full border text-[11px] font-mono ${
                      i.prewired
                        ? 'border-signal/60 text-signal bg-signal/10'
                        : 'hairline text-muted-foreground'
                    }`}
                  >
                    {i.label}
                    {i.prewired && <span className="text-[9px]">prewired</span>}
                  </span>
                ))}
              </div>

              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-2">
                Deploy log
              </div>
              <pre className="rounded-md border hairline bg-graphite-2/60 p-4 mb-5 font-mono text-[12px] leading-relaxed overflow-x-auto">
{selected.deploy_log
  .map((s) => {
    const lat =
      s.latency_ms >= 1000
        ? `${(s.latency_ms / 1000).toFixed(1)}s`
        : `${s.latency_ms}ms`;
    const okMark = s.status === 'ok' ? 'ok' : 'failed';
    const note = s.note ? `  ${s.note}` : '';
    return `  ◎ ${s.name.padEnd(22, ' ')}  ${okMark.padEnd(6, ' ')} ${lat}${note}`;
  })
  .join('\n')}
              </pre>

              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-2">
                Packets routed through this endpoint ({endpointPackets.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px] font-mono">
                  <thead className="text-muted-foreground">
                    <tr className="border-b hairline">
                      <th className="py-2 pr-3 font-normal">time</th>
                      <th className="py-2 pr-3 font-normal">packet</th>
                      <th className="py-2 pr-3 font-normal">layer</th>
                      <th className="py-2 pr-3 font-normal text-right">tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpointPackets.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-6 text-muted-foreground">
                          No packets routed yet. Toggle &quot;route through endpoint&quot;
                          on the query form and submit a query.
                        </td>
                      </tr>
                    )}
                    {endpointPackets.slice(0, 20).map((e) => {
                      const m = e.metadata as {
                        layer: string;
                        tokens: number;
                      };
                      return (
                        <tr key={e.event_id} className="border-b hairline">
                          <td className="py-2 pr-3 text-muted-foreground">
                            {new Date(e.created_at).toLocaleTimeString()}
                          </td>
                          <td className="py-2 pr-3 text-signal truncate max-w-[22ch]">
                            {e.packet_id}
                          </td>
                          <td className="py-2 pr-3">{m.layer}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {m.tokens}
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

function EndpointStatusBadge({ status }: { status: EndpointStatus }) {
  const tone =
    status === 'live'
      ? 'text-evidence-good'
      : status === 'provisioning'
        ? 'text-cyan'
        : status === 'paused'
          ? 'text-evidence-warn'
          : 'text-evidence-bad';
  return (
    <span className={`text-[10px] uppercase tracking-[0.18em] ${tone}`}>{status}</span>
  );
}
