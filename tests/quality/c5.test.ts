/**
 * Retrieval quality — conversion phase C5.
 *
 * The telemetry loop (feedback → usage_success → scorer), the staleness
 * re-verification job, the hybrid-only vector fallback, and the training
 * corpus. Behavior tests run in every mode; persistence/rebuild tests are
 * Postgres-only (`npm run test:pg`).
 */
import { beforeEach, describe, it, expect } from 'vitest';
import { resetData } from '../conformance/helpers';
import { write } from '@/lib/memory/write';
import { retrieve } from '@/lib/memory/retrieve';
import { recordFeedback } from '@/lib/memory/telemetry';
import { reverifyStaleness } from '@/lib/memory/staleness';
import { getRecord } from '@/lib/memory/registry';
import { loadOverlay } from '@/lib/memory/governance';
import { usageStats, UsageStatsRail, usageStatsConsumer } from '@/lib/rails/usage';
import { runConsumer } from '@/lib/ledger/consumers';
import { authorityMode, flushAuthority, getDb } from '@/lib/memory/authority';

const PROJECT = 'project_quality_c5';
const pgOnly = authorityMode() === 'postgres' ? describe : describe.skip;

describe('C5.1 — usage_success closes the loop', () => {
  beforeEach(resetData);

  it('feedback fans out to the bundle memories and lifts their score', () => {
    const liked = write({ content: 'Quality loop: the memory users keep endorsing.', project_id: PROJECT, tags: ['quality'], confidence: 0.85 });
    const bundle = retrieve({ task_context: 'quality loop memory endorsing', project_id: PROJECT });
    expect(bundle.memories.map((m) => m.memory_id)).toContain(liked.memory_id);

    // Retrieval-level positive feedback (no memory_id) credits every returned memory.
    recordFeedback({ retrieval_id: bundle.retrieval_id, rating: 'positive' });
    recordFeedback({ retrieval_id: bundle.retrieval_id, rating: 'positive' });
    expect(usageStats.usageSuccess(liked.memory_id)).toBeGreaterThan(0);

    // The scorer reports the term in the debug trace.
    const debug = retrieve({ task_context: 'quality loop memory endorsing', project_id: PROJECT, retrieval_mode: 'debug' });
    const breakdown = debug.retrieval_trace.scoring?.find((s) => s.memory_id === liked.memory_id);
    expect(breakdown?.usage_success).toBeGreaterThan(0);

    // Negative feedback pushes the other way, bounded.
    recordFeedback({ retrieval_id: bundle.retrieval_id, rating: 'negative', memory_id: liked.memory_id });
    expect(Math.abs(usageStats.usageSuccess(liked.memory_id))).toBeLessThanOrEqual(0.15);
  });
});

describe('C5.2 — staleness re-verification on expires_at', () => {
  beforeEach(resetData);

  it('downgrades past-expiry records through an evented, versioned re-score', () => {
    const stale = write({
      content: 'Quality staleness: fact with a validity window.',
      project_id: PROJECT,
      confidence: 0.9,
      expires_at: new Date(Date.now() - 86_400_000).toISOString(), // expired yesterday
    });
    const fresh = write({
      content: 'Quality staleness: fact expiring soon.',
      project_id: PROJECT,
      confidence: 0.9,
      expires_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    });

    const report = reverifyStaleness();
    expect(report.expired.map((e) => e.memory_id)).toContain(stale.memory_id);
    expect(report.expiring_soon.map((e) => e.memory_id)).toContain(fresh.memory_id);

    const after = getRecord(stale.memory_id, { force: true })!;
    expect(after.confidence).toBeCloseTo(0.72, 3); // 0.9 × 0.8
    // Governed: the downgrade is a versioned transition, not a silent mutation.
    const versions = loadOverlay()[stale.memory_id]?.versions ?? [];
    expect(versions.some((v) => v.change_type === 'UPDATE_CONFIDENCE' && v.changed_by === 'staleness_job')).toBe(true);

    // A periodic job must not compound decay: a second real run skips the
    // already-reverified record instead of downgrading 0.72 → 0.576.
    const second = reverifyStaleness();
    expect(second.already_reverified).toContain(stale.memory_id);
    expect(second.expired.map((e) => e.memory_id)).not.toContain(stale.memory_id);
    expect(getRecord(stale.memory_id, { force: true })!.confidence).toBeCloseTo(0.72, 3);
    const stalenessVersions = (loadOverlay()[stale.memory_id]?.versions ?? []).filter(
      (v) => v.changed_by === 'staleness_job',
    );
    expect(stalenessVersions).toHaveLength(1);

    // And a dry run reports without mutating.
    const dry = reverifyStaleness({ dry_run: true });
    expect(getRecord(stale.memory_id, { force: true })!.confidence).toBeCloseTo(0.72, 3);
    expect(dry.already_reverified).toContain(stale.memory_id);
  });
});

describe('C5.3 — vector fallback: hybrid only, trace-recorded', () => {
  beforeEach(resetData);

  it('fires in hybrid mode on weak tree signal and surfaces deep-content matches', () => {
    // Summary carries none of the query vocabulary; the content does — so the
    // tree (which reasons over titles/summaries/paths) has a weak signal.
    write({
      content:
        'Quality corner case. The zephyrite calibration harmonics drift under sustained quantum flux readings.',
      summary: 'Quality corner case.',
      project_id: PROJECT,
      tags: [],
      confidence: 0.9,
    });

    const hybrid = retrieve({ task_context: 'zephyrite calibration harmonics', project_id: PROJECT, retrieval_mode: 'hybrid' });
    expect(hybrid.retrieval_trace.policy_filters_applied).toContain('vector_fallback');
    expect(hybrid.memories.some((m) => m.content === undefined && m.summary === 'Quality corner case.')).toBe(true);

    // Never the primary path: tree mode does not fire it.
    const tree = retrieve({ task_context: 'zephyrite calibration harmonics', project_id: PROJECT, retrieval_mode: 'tree' });
    expect(tree.retrieval_trace.policy_filters_applied).not.toContain('vector_fallback');

    // And a strong tree signal keeps hybrid on the tree path.
    write({ content: 'Quality mainstream: retrieval pipeline decision.', project_id: PROJECT, tags: ['pipeline'], confidence: 0.9 });
    const strong = retrieve({ task_context: 'quality mainstream retrieval pipeline decision', project_id: PROJECT, retrieval_mode: 'hybrid' });
    expect(strong.retrieval_trace.policy_filters_applied).not.toContain('vector_fallback');
  });
});

pgOnly('C5.4 — training corpus (structure and decisions, never content)', () => {
  beforeEach(resetData);

  it('persists every retrieval with breakdowns and appends feedback outcomes', async () => {
    write({ content: 'Training corpus: subject memory.', project_id: PROJECT, confidence: 0.9 });
    const bundle = retrieve({ task_context: 'training corpus subject memory', project_id: PROJECT });
    recordFeedback({ retrieval_id: bundle.retrieval_id, rating: 'positive' });
    await flushAuthority();

    const db = await getDb();
    const rows = await db.query<{
      task_context_hash: string;
      scoring: unknown[];
      returned_ids: string[];
      outcome: Array<{ rating: string }>;
      vector_fallback: boolean;
    }>('SELECT task_context_hash, scoring, returned_ids, outcome, vector_fallback FROM retrieval_training WHERE retrieval_id = $1', [
      bundle.retrieval_id,
    ]);
    expect(rows.rows).toHaveLength(1);
    const row = rows.rows[0];
    expect(row.scoring.length).toBeGreaterThan(0);
    expect(row.returned_ids).toEqual(bundle.memories.map((m) => m.memory_id));
    expect(row.outcome?.[0]?.rating).toBe('positive');
    expect(row.vector_fallback).toBe(false);
    // §9: no memory content in the training row — the context is hashed.
    expect(row.task_context_hash).not.toContain('training corpus');
  });
});

pgOnly('C5.1 — usage projection rebuilds from the ledger', () => {
  beforeEach(resetData);

  it('replay reconstructs the live usage stats exactly', async () => {
    const m = write({ content: 'Usage rebuild: rated memory.', project_id: PROJECT, confidence: 0.9 });
    const bundle = retrieve({ task_context: 'usage rebuild rated memory', project_id: PROJECT });
    recordFeedback({ retrieval_id: bundle.retrieval_id, rating: 'positive' });
    recordFeedback({ retrieval_id: bundle.retrieval_id, rating: 'negative', memory_id: m.memory_id });
    await flushAuthority();

    const rebuilt = new UsageStatsRail();
    await runConsumer(usageStatsConsumer(rebuilt));
    expect(rebuilt.stat(m.memory_id)).toEqual(usageStats.stat(m.memory_id));
    expect(rebuilt.usageSuccess(m.memory_id)).toBe(usageStats.usageSuccess(m.memory_id));
  });
});
