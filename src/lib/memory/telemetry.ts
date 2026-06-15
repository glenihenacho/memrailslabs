import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ContextBundle } from '@/types/bundle';
import { logEvent } from '@/lib/ledger/events';
import { dataPath } from '@/lib/paths';
import { hotRetrievals } from '@/lib/rails/hot';
import { shortHash } from '@/lib/observability/hash';

/**
 * Retrieval telemetry. Every `memory.retrieve()` writes a full record here so
 * the Console can replay the trace, and a compact ledger event for billing and
 * the query stream. This is the `retrieval_events` + `retrieval_results` store.
 */

function retrievalsFile(): string {
  return dataPath('logs', 'retrievals.jsonl');
}
function feedbackFile(): string {
  return dataPath('logs', 'feedback.jsonl');
}

export type FeedbackRecord = {
  feedback_id: string;
  retrieval_id: string;
  memory_id?: string;
  rating: 'positive' | 'negative';
  feedback_type?: string;
  comment?: string;
  created_at: string;
};

function append(path: string, obj: unknown): void {
  if (!existsSync(dirname(path))) mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(obj)}\n`, 'utf8');
}

export function recordRetrieval(bundle: ContextBundle): void {
  hotRetrievals.set(bundle.retrieval_id, bundle); // Hot Rail: keep recent state warm
  append(retrievalsFile(), bundle);
  logEvent(
    'MEMORY_RETRIEVED',
    {
      task_context_hash: shortHash(bundle.query),
      mode: bundle.mode,
      latency_ms: bundle.latency_ms,
      memories_considered: bundle.retrieval_trace.candidates_considered,
      memories_returned: bundle.memories.length,
      tokens_returned: bundle.tokens_returned,
      omitted_count: bundle.omitted.length,
      branches_selected: bundle.retrieval_trace.branches_selected,
      success: bundle.memories.length > 0,
    },
    {
      retrieval_id: bundle.retrieval_id,
      owner_id: bundle.scope.owner_id,
      project_id: bundle.scope.project_id,
      agent_id: bundle.scope.agent_id ?? undefined,
    },
  );
}

export function findRetrieval(retrieval_id: string): ContextBundle | null {
  const hot = hotRetrievals.get(retrieval_id); // Hot Rail before cold scan
  if (hot) return hot as ContextBundle;
  const path = retrievalsFile();
  if (!existsSync(path)) return null;
  const lines = readFileSync(path, 'utf8').split('\n');
  // Walk newest-first so a re-run wins.
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    try {
      const bundle = JSON.parse(trimmed) as ContextBundle;
      if (bundle.retrieval_id === retrieval_id) return bundle;
    } catch {
      // skip
    }
  }
  return null;
}

export function recordFeedback(input: Omit<FeedbackRecord, 'feedback_id' | 'created_at'>): FeedbackRecord {
  const record: FeedbackRecord = {
    feedback_id: `fbk_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    created_at: new Date().toISOString(),
    ...input,
  };
  append(feedbackFile(), record);
  logEvent(
    'FEEDBACK_RECORDED',
    { rating: record.rating, feedback_type: record.feedback_type, memory_id: record.memory_id },
    { retrieval_id: record.retrieval_id, memory_id: record.memory_id },
  );
  return record;
}

export function readFeedback(): FeedbackRecord[] {
  const path = feedbackFile();
  if (!existsSync(path)) return [];
  const out: FeedbackRecord[] = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as FeedbackRecord);
    } catch {
      // skip
    }
  }
  return out;
}

export function retrievalsPath(): string {
  return retrievalsFile();
}
