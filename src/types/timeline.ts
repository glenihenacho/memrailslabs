/**
 * Temporal retrieval — the completeness contract.
 *
 * Distinct from `memory.retrieve()` (relevance-ranked, token-budgeted, lossy).
 * A timeline returns **all** in-scope memory for a window — never relevance-
 * pruned, never budget-dropped — organized deterministically by topic and
 * ordered by system time. The compiler only **selects & organizes** canonical
 * records; it never synthesizes or invents content.
 *
 * Two modes:
 *  - `window`  — every record created within `[from, to]`, any status, so the
 *    full historical record of that segment is returned.
 *  - `as_of`   — the live active set reconstructed at an instant, using the
 *    high-fidelity system timestamps on each record + its version chain.
 */

import type { MemoryStatus } from './governed';

export type TimelineMode = 'window' | 'as_of';

export type TimelineEntry = {
  memory_id: string;
  summary: string;
  index_path: string;
  source_file: string;
  created_at: string;
  /** Current status in the live registry. */
  status: MemoryStatus;
  /** Status reconstructed at `as_of` (as_of mode only). */
  status_as_of?: MemoryStatus;
  version_count: number;
};

export type TimelineSection = {
  path: string;
  title: string;
  entries: TimelineEntry[];
};

export type TimelineInput = {
  owner_id?: string;
  project_id?: string;
  /** ISO bounds for `window` mode (inclusive; open-ended if omitted). */
  from?: string;
  to?: string;
  /** ISO instant for `as_of` mode (reconstruct the active set at this time). */
  as_of?: string;
};

export type Timeline = {
  scope: { owner_id: string; project_id?: string };
  contract: 'completeness';
  mode: TimelineMode;
  from?: string;
  to?: string;
  as_of?: string;
  /** Total records returned — completeness, so this is every match, no prune. */
  total: number;
  sections: TimelineSection[];
  /** Flat, system-time-ordered view across all topics. */
  chronological: TimelineEntry[];
  compiled_at: string;
};
