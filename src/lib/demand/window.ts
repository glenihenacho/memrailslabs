import type { Window } from '@/types/demand';

const DURATION_RE = /^(\d+)(s|m|h|d)$/;

const UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/**
 * Parses a `since` argument into a Window ending at `until` (default: now).
 * Accepts a relative duration (`24h`, `7d`, `30m`) or an ISO timestamp.
 */
export function parseWindow(since: string | undefined, until?: Date): Window {
  const end = until ?? new Date();
  const start = (() => {
    if (!since) return new Date(end.getTime() - 24 * UNIT_MS.h);
    const m = DURATION_RE.exec(since);
    if (m) {
      const n = Number(m[1]);
      const unit = m[2];
      return new Date(end.getTime() - n * UNIT_MS[unit]);
    }
    const t = Date.parse(since);
    if (!Number.isNaN(t)) return new Date(t);
    // Unparseable falls back to 24h.
    return new Date(end.getTime() - 24 * UNIT_MS.h);
  })();
  return { since: start.toISOString(), until: end.toISOString() };
}
