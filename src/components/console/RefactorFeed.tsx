'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RefactorProposal, RefactorStatus, ValidatorReport } from '@/types/refactor';

type RefactorSummary = {
  refactor_id: string;
  type: RefactorProposal['type'];
  target_file?: string;
  target_claim_id?: string;
  status: RefactorStatus;
  claim_preview: string;
  validator: ValidatorReport;
  stake?: number;
  created_at: string;
  updated_at: string;
};

type ListResponse = { refactors: RefactorSummary[] };

const STATUS_COLORS: Record<RefactorStatus, string> = {
  proposed: 'text-cyan',
  reviewing: 'text-cyan',
  accepted: 'text-evidence-good',
  rejected: 'text-evidence-bad',
};

export function RefactorFeed() {
  const [items, setItems] = useState<RefactorSummary[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RefactorProposal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/refactors', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as ListResponse;
      setItems(data.refactors);
    } catch {
      // network blip — leave current list in place
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const expand = async (refactor_id: string) => {
    if (expandedId === refactor_id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(refactor_id);
    setDetail(null);
    setError(null);
    try {
      const res = await fetch(`/api/refactors/${refactor_id}`, { cache: 'no-store' });
      if (!res.ok) {
        setError(`refactor ${refactor_id} not found`);
        return;
      }
      const data = (await res.json()) as RefactorProposal;
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const accept = async (refactor_id: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/refactors/${refactor_id}/accept`, { method: 'POST' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
        setError(body.detail || body.error || `HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as RefactorProposal;
      setDetail(data);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const reject = async (refactor_id: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/refactors/${refactor_id}/reject`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason || undefined }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
        setError(body.detail || body.error || `HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as RefactorProposal;
      setDetail(data);
      setRejectReason('');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border hairline bg-graphite/40 shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-4 h-10 border-b hairline bg-graphite-2">
        <div className="text-[11px] font-mono text-muted-foreground">memory.write() · refactor feed</div>
        <div className="text-[11px] font-mono text-muted-foreground">
          {items.length} proposal{items.length === 1 ? '' : 's'}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px] font-mono">
          <thead className="text-muted-foreground">
            <tr className="border-b hairline">
              <th className="py-2 pl-5 pr-3 font-normal">id</th>
              <th className="py-2 pr-3 font-normal">type</th>
              <th className="py-2 pr-3 font-normal">target</th>
              <th className="py-2 pr-3 font-normal">status</th>
              <th className="py-2 pr-3 font-normal">validator</th>
              <th className="py-2 pr-5 font-normal">claim</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 pl-5 text-muted-foreground">
                  No refactor proposals yet. Send one via{' '}
                  <code className="text-signal">memory.write</code>.
                </td>
              </tr>
            )}
            {items.map((r) => {
              const isOpen = expandedId === r.refactor_id;
              return (
                <RowGroup
                  key={r.refactor_id}
                  row={r}
                  isOpen={isOpen}
                  detail={isOpen ? detail : null}
                  error={isOpen ? error : null}
                  rejectReason={rejectReason}
                  onRejectReasonChange={setRejectReason}
                  busy={busy}
                  onToggle={() => expand(r.refactor_id)}
                  onAccept={() => accept(r.refactor_id)}
                  onReject={() => reject(r.refactor_id)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RowGroup({
  row,
  isOpen,
  detail,
  error,
  rejectReason,
  onRejectReasonChange,
  busy,
  onToggle,
  onAccept,
  onReject,
}: {
  row: RefactorSummary;
  isOpen: boolean;
  detail: RefactorProposal | null;
  error: string | null;
  rejectReason: string;
  onRejectReasonChange: (v: string) => void;
  busy: boolean;
  onToggle: () => void;
  onAccept: () => void;
  onReject: () => void;
}) {
  const canAct = row.status === 'proposed' || row.status === 'reviewing';
  return (
    <>
      <tr
        onClick={onToggle}
        className={`border-b hairline align-top cursor-pointer hover:bg-graphite-2/40 transition ${
          isOpen ? 'bg-graphite-2/60 border-l-2 border-l-signal' : ''
        }`}
      >
        <td className="py-2 pl-5 pr-3 text-signal">{row.refactor_id}</td>
        <td className="py-2 pr-3">{row.type}</td>
        <td className="py-2 pr-3 text-muted-foreground truncate max-w-[28ch]">
          {row.target_file ?? '—'}
        </td>
        <td className={`py-2 pr-3 ${STATUS_COLORS[row.status]}`}>{row.status}</td>
        <td className="py-2 pr-3">
          {row.validator.ok ? (
            <span className="text-evidence-good">ok</span>
          ) : (
            <span className="text-evidence-warn">{row.validator.issues.length} issue(s)</span>
          )}
        </td>
        <td className="py-2 pr-5 text-muted-foreground truncate max-w-[36ch]">
          {row.claim_preview}
        </td>
      </tr>
      {isOpen && (
        <tr className="border-b hairline bg-graphite-2/30">
          <td colSpan={6} className="p-5">
            {!detail && !error && (
              <div className="text-[12px] text-muted-foreground">loading…</div>
            )}
            {error && (
              <div className="text-[12px] font-mono text-evidence-bad">{error}</div>
            )}
            {detail && (
              <div className="space-y-4">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-2">
                    Unified diff
                  </div>
                  <pre className="font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-foreground bg-graphite/60 border hairline rounded-md p-3 overflow-x-auto">
{detail.proposed_diff}
                  </pre>
                </div>
                <div className="grid sm:grid-cols-2 gap-3 text-[11.5px] font-mono">
                  <Meta label="claim_id" value={detail.claim_id} />
                  <Meta label="target_file" value={detail.target_file ?? '—'} />
                  <Meta label="stake" value={detail.stake != null ? String(detail.stake) : '—'} />
                  <Meta
                    label="evidence_refs"
                    value={
                      detail.evidence_refs.length > 0 ? detail.evidence_refs.join(', ') : '—'
                    }
                  />
                </div>
                {detail.validator.issues.length > 0 && (
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-2">
                      Validator issues
                    </div>
                    <ul className="font-mono text-[12px] text-evidence-warn list-disc pl-5">
                      {detail.validator.issues.map((i) => (
                        <li key={i}>{i}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {canAct && (
                  <div className="flex items-end gap-3 pt-2 border-t hairline">
                    <label className="flex-1">
                      <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                        rejection reason (optional)
                      </span>
                      <input
                        type="text"
                        value={rejectReason}
                        onChange={(e) => onRejectReasonChange(e.target.value)}
                        className="mt-2 w-full rounded-md border hairline bg-graphite-2/60 px-3 py-2 font-mono text-[12px] focus:border-signal/60 focus:outline-none"
                        placeholder="why are you rejecting?"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={onReject}
                      className="h-9 px-4 rounded-md border hairline text-[12px] font-mono text-evidence-bad hover:bg-graphite-2/60 disabled:opacity-50"
                    >
                      reject
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={onAccept}
                      className="h-9 px-4 rounded-md bg-signal text-signal-foreground font-semibold text-[12px] shadow-signal hover:opacity-95 disabled:opacity-50"
                    >
                      accept →
                    </button>
                  </div>
                )}
                {detail.status === 'accepted' && detail.applied_path && (
                  <div className="text-[12px] font-mono text-evidence-good">
                    accepted · wrote {detail.applied_path}
                  </div>
                )}
                {detail.status === 'rejected' && (
                  <div className="text-[12px] font-mono text-evidence-bad">
                    rejected{detail.reason ? ` · ${detail.reason}` : ''}
                  </div>
                )}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <span className="truncate text-foreground">{value}</span>
    </div>
  );
}
