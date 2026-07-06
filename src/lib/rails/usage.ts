/**
 * Usage-success projection (C5.1) — the telemetry loop's read side.
 *
 * FEEDBACK_RECORDED events (v2: fanned out to the memory ids of the rated
 * retrieval) accumulate per-memory positive/negative counts; the retrieval
 * scorer reads a bounded `usage_success` term from here, closing the loop:
 * retrieval → feedback → ranking. Same C4 projection law: one handler, fed
 * live by the bus and rebuildable from the ledger, Postgres wins.
 */

import type { LedgerEvent } from '@/types/ledger';
import { subscribe } from '@/lib/ledger/bus';
import type { LedgerConsumer } from '@/lib/ledger/consumers';

export type UsageStat = { memory_id: string; positive: number; negative: number };

/** Cap of the usage_success contribution to the additive score. */
const MAX_CONTRIBUTION = 0.15;

export class UsageStatsRail {
  private stats = new Map<string, UsageStat>();

  /** One handler for both feeds: the live bus and the rebuild consumer. */
  handleEvent(event: LedgerEvent): void {
    if (event.event_type !== 'FEEDBACK_RECORDED') return;
    const rating = event.metadata?.rating as 'positive' | 'negative' | undefined;
    if (!rating) return;
    const ids = new Set<string>([
      ...((event.metadata?.memory_ids as string[] | undefined) ?? []), // v2 fan-out
      ...(event.memory_id ? [event.memory_id] : []),
    ]);
    for (const memory_id of ids) {
      const cur = this.stats.get(memory_id) ?? { memory_id, positive: 0, negative: 0 };
      if (rating === 'positive') cur.positive += 1;
      else cur.negative += 1;
      this.stats.set(memory_id, cur);
    }
  }

  /**
   * Bounded, smoothed contribution in [-0.15, +0.15]:
   * (pos − neg) / (pos + neg + 2) × cap — Laplace smoothing keeps a single
   * vote from dominating; no data means exactly 0 (the pre-C5 behavior).
   */
  usageSuccess(memory_id: string): number {
    const s = this.stats.get(memory_id);
    if (!s) return 0;
    return Number((((s.positive - s.negative) / (s.positive + s.negative + 2)) * MAX_CONTRIBUTION).toFixed(4));
  }

  stat(memory_id: string): UsageStat | undefined {
    return this.stats.get(memory_id);
  }

  get size(): number {
    return this.stats.size;
  }

  clear(): void {
    this.stats.clear();
  }
}

/** Shared usage projection, kept warm by the live bus. */
export const usageStats = new UsageStatsRail();
subscribe('usage_stats', (event) => usageStats.handleEvent(event));

/** Rebuild feed: the same handler as a cursor-tracked ledger consumer. */
export function usageStatsConsumer(rail: UsageStatsRail = usageStats): LedgerConsumer {
  return { name: 'rail_usage_stats', handle: (event) => rail.handleEvent(event) };
}
