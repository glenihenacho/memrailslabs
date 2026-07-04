import type { ContextBundle } from '@/types/bundle';
import type { RetrievalUsage } from '@/types/billing';

/**
 * Metering seam — the kernel's only view of billing.
 *
 * The governed kernel (`src/lib/memory`, `src/lib/ledger`, `src/lib/rails`,
 * `src/types`) must not depend on the billing shell (contract v0.1 §10;
 * conversion phase C0). Retrieval still surfaces usage on every bundle, so the
 * shell installs its meter here and `retrieve()` calls through the hook.
 *
 * The default is an explicit zero-usage meter: an unmetered runtime (self-host,
 * bare library use) returns `billable_retrievals: 0` rather than inventing
 * charges it never recorded. Product entrypoints (API routes, MCP tools, CLI)
 * import `@/lib/billing/meter`, which self-installs the real meter.
 */
export type RetrievalMeter = (bundle: ContextBundle) => RetrievalUsage;

const UNMETERED: RetrievalUsage = {
  billable_retrievals: 0,
  billable_units: 0,
  credits_remaining: 0,
  credit_exhausted: false,
};

let installed: RetrievalMeter | null = null;

/** Install the shell's meter. Last install wins (idempotent re-imports are fine). */
export function setRetrievalMeter(meter: RetrievalMeter): void {
  installed = meter;
}

/** Meter one bundle through the installed meter, or report unmetered usage. */
export function meterBundle(bundle: ContextBundle): RetrievalUsage {
  return installed ? installed(bundle) : { ...UNMETERED };
}
