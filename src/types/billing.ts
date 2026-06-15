/**
 * Billing model — metered by memory retrieval.
 *
 * The commercial primitive is one successful `memory.retrieve()` = one billable
 * retrieval. Writes are cheap/free (they create future retrieval value); context
 * tokens are NOT billed here (the model provider already charges those). See
 * `knowledge/billing-model.md`.
 */

export type BillingMode = 'standard' | 'deep' | 'bulk' | 'debug';

/**
 * Full multiplier table. v1 stays simple — `SIMPLE_V1` forces every retrieval to
 * 1.0 unit. Flip the flag to enable tiered units without changing the API.
 */
export const RETRIEVAL_MULTIPLIERS: Record<BillingMode, number> = {
  standard: 1.0,
  deep: 3.0,
  bulk: 1.0, // bulk multiplies by N requests, handled by caller
  debug: 1.5,
};

export const SIMPLE_V1 = true;

/** Per-retrieval price. $0.002 / retrieval = $2 per 1,000. */
export const PRICE_PER_RETRIEVAL_USD = 0.002;

/** Free accounts start with retrieval credits, not memory/agent caps. */
export const STARTER_RETRIEVAL_CREDITS = 2500;

export type RetrievalBillingEvent = {
  event_id: string;
  retrieval_id: string;
  owner_id: string;
  agent_id?: string;
  project_id: string;
  retrieval_mode: string;
  billable_units: number;
  internal_cost_estimate: number;
  price_charged_usd: number;
  latency_ms: number;
  memories_considered: number;
  memories_returned: number;
  context_tokens_returned: number;
  created_at: string;
};

/** Internal cost accounting — never exposed to the user. */
export type RetrievalCostEvent = {
  retrieval_id: string;
  sql_cost_units: number;
  cache_cost_units: number;
  storage_cost_units: number;
  index_cost_units: number;
  reasoning_cost_units: number;
  telemetry_cost_units: number;
  estimated_total_cost: number;
  /** Federated NoSQL accounts touched by this retrieval. */
  storage_accounts: string[];
  created_at: string;
};

/** What the local agent sees on the bundle — usage is intentionally minimal. */
export type RetrievalUsage = {
  billable_retrievals: number;
  billable_units: number;
  credits_remaining: number | null; // null = unlimited (paid plans)
  credit_exhausted: boolean;
};
