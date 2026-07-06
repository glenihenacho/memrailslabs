import type { MemoryRecord } from '@/types/governed';
import { loadRegistry } from './registry';
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
};

const DECAY = 0.8; // one re-verification pass costs 20% confidence
const SOON_DAYS = 14;

export function reverifyStaleness(opts: { now?: number; dry_run?: boolean } = {}): StalenessReport {
  const now = opts.now ?? Date.now();
  const report: StalenessReport = { scanned: 0, expired: [], expiring_soon: [] };

  const withExpiry = loadRegistry({ force: true }).filter(
    (r): r is MemoryRecord & { expires_at: string } => Boolean(r.expires_at) && r.status === 'active',
  );
  report.scanned = withExpiry.length;

  for (const record of withExpiry) {
    const expires = Date.parse(record.expires_at);
    if (Number.isNaN(expires)) continue;
    if (expires < now) {
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
