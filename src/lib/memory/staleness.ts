import type { MemoryRecord } from '@/types/governed';
import { loadRegistry } from './registry';
import { loadOverlay } from './governance';
import { updateConfidence } from './lifecycle';

/**
 * Staleness re-verification (C5.2).
 *
 * Records carry an optional `expires_at` — a validity window, not a delete
 * date. Policy already excludes expired records from retrieval; this job
 * makes the decay *governed*: every active record past its window gets an
 * evented, versioned confidence downgrade (through `updateConfidence`, so
 * the C3 spine records it) and lands in a report a human or agent can act
 * on — re-verify and `restore`/re-score, or `forget`.
 */

export type StalenessReport = {
  scanned: number;
  expired: Array<{ memory_id: string; expires_at: string; confidence_before: number; confidence_after: number }>;
  expiring_soon: Array<{ memory_id: string; expires_at: string }>;
  /** Already downgraded for this expiry window in a previous run — skipped. */
  already_reverified: string[];
};

const DECAY = 0.8; // one re-verification pass costs 20% confidence
const SOON_DAYS = 14;

/** One downgrade per expiry window: a periodic job must not compound decay. */
function alreadyReverified(memory_id: string, expires_at: string): boolean {
  const versions = loadOverlay()[memory_id]?.versions ?? [];
  return versions.some(
    (v) =>
      v.change_type === 'UPDATE_CONFIDENCE' &&
      v.changed_by === 'staleness_job' &&
      v.diff_summary.includes(expires_at),
  );
}

export function reverifyStaleness(opts: { now?: number; dry_run?: boolean } = {}): StalenessReport {
  const now = opts.now ?? Date.now();
  const report: StalenessReport = { scanned: 0, expired: [], expiring_soon: [], already_reverified: [] };

  const withExpiry = loadRegistry({ force: true }).filter(
    (r): r is MemoryRecord & { expires_at: string } => Boolean(r.expires_at) && r.status === 'active',
  );
  report.scanned = withExpiry.length;

  for (const record of withExpiry) {
    const expires = Date.parse(record.expires_at);
    if (Number.isNaN(expires)) continue;
    if (expires < now) {
      if (alreadyReverified(record.memory_id, record.expires_at)) {
        report.already_reverified.push(record.memory_id);
        continue;
      }
      const confidence_after = Number((record.confidence * DECAY).toFixed(3));
      if (!opts.dry_run) {
        updateConfidence(record.memory_id, {
          confidence: confidence_after,
          reason: `staleness re-verification: past expires_at ${record.expires_at}`,
          changed_by: 'staleness_job',
        });
      }
      report.expired.push({
        memory_id: record.memory_id,
        expires_at: record.expires_at,
        confidence_before: record.confidence,
        confidence_after,
      });
    } else if (expires < now + SOON_DAYS * 86_400_000) {
      report.expiring_soon.push({ memory_id: record.memory_id, expires_at: record.expires_at });
    }
  }

  return report;
}
