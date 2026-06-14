import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { dataPath } from '@/lib/paths';
import { logEvent } from '@/lib/ledger/events';
import { debit } from '@/lib/accounts/store';
import { railRouter, type RailContext } from '@/lib/rails/router';
import {
  PRICE_PER_RETRIEVAL_USD,
  RETRIEVAL_MULTIPLIERS,
  SIMPLE_V1,
  type BillingMode,
  type RetrievalBillingEvent,
  type RetrievalCostEvent,
  type RetrievalUsage,
} from '@/types/billing';
import type { ContextBundle } from '@/types/bundle';

function append(path: string, obj: unknown): void {
  if (!existsSync(dirname(path))) mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(obj)}\n`, 'utf8');
}

/** Map a retrieval mode to a billing class, then to units. v1 stays at 1.0. */
export function billableUnits(mode: string): number {
  if (SIMPLE_V1) return 1.0;
  const billingMode: BillingMode = mode === 'debug' ? 'debug' : 'standard';
  return RETRIEVAL_MULTIPLIERS[billingMode];
}

function estimateInternalCost(bundle: ContextBundle): RetrievalCostEvent {
  const t = bundle.retrieval_trace;
  const sql = Number((0.01 + t.candidates_considered * 0.001).toFixed(4));
  const cache = 0.002;
  const storage = Number((bundle.memories.length * 0.002).toFixed(4));
  const index = Number((t.root_nodes_visited * 0.001).toFixed(4));
  const reasoning = bundle.mode === 'debug' ? 0.01 : 0;
  const telemetry = 0.002;
  const rails = railRouter.retrievalRails().map((r) => `${r.kind}:${r.pool}:${r.provider}`);
  return {
    retrieval_id: bundle.retrieval_id,
    sql_cost_units: sql,
    cache_cost_units: cache,
    storage_cost_units: storage,
    index_cost_units: index,
    reasoning_cost_units: reasoning,
    telemetry_cost_units: telemetry,
    estimated_total_cost: Number((sql + cache + storage + index + reasoning + telemetry).toFixed(4)),
    rails_used: rails,
    created_at: new Date().toISOString(),
  };
}

/**
 * Meter one retrieval. 1 successful `memory.retrieve()` = 1 billable retrieval.
 * Writes the public billing event + the internal cost event, debits the
 * account's credits, and returns the minimal usage surfaced on the bundle.
 */
export function meterRetrieval(bundle: ContextBundle, _ctx: RailContext = {}): RetrievalUsage {
  const units = billableUnits(bundle.mode);
  const price = Number((units * PRICE_PER_RETRIEVAL_USD).toFixed(6));
  const cost = estimateInternalCost(bundle);

  const billing: RetrievalBillingEvent = {
    event_id: `bil_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    retrieval_id: bundle.retrieval_id,
    owner_id: bundle.scope.owner_id,
    agent_id: bundle.scope.agent_id ?? undefined,
    project_id: bundle.scope.project_id,
    retrieval_mode: bundle.mode,
    billable_units: units,
    internal_cost_estimate: cost.estimated_total_cost,
    price_charged_usd: price,
    latency_ms: bundle.latency_ms,
    memories_considered: bundle.retrieval_trace.candidates_considered,
    memories_returned: bundle.memories.length,
    context_tokens_returned: bundle.tokens_returned,
    created_at: new Date().toISOString(),
  };

  append(dataPath('logs', 'billing.jsonl'), billing);
  append(dataPath('logs', 'costs.jsonl'), cost);

  const { credits_remaining, exhausted } = debit(bundle.scope.owner_id, units, price);

  logEvent(
    'RETRIEVAL_BILLED',
    { billable_units: units, price_usd: price, internal_cost: cost.estimated_total_cost, mode: bundle.mode },
    {
      retrieval_id: bundle.retrieval_id,
      owner_id: bundle.scope.owner_id,
      project_id: bundle.scope.project_id,
      cost_cents: Math.round(price * 100),
    },
  );

  return {
    billable_retrievals: 1,
    billable_units: units,
    credits_remaining,
    credit_exhausted: exhausted,
  };
}
