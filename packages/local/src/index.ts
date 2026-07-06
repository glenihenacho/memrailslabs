/**
 * @memrails/local — the MemRails contract v0.1.1 kernel as a self-contained,
 * embeddable runtime (conversion phase C7).
 *
 * This is the file-canonical backend of the reference implementation, packaged
 * for self-hosting (contract §1, CLAUDE.md Rule 7 — no lock-in): a local agent
 * embeds `retrieve()` in-process against its own markdown corpus and data
 * directory. The same code runs Postgres-canonical when `MEMRAILS_AUTHORITY`
 * selects it — conformance is identical by construction, proven by the
 * conformance suite and the cross-runtime round-trip test.
 *
 * Environment:
 *   MEMRAILS_DATA_DIR       writable store (default `<cwd>/data`)
 *   MEMRAILS_KNOWLEDGE_DIR  canonical markdown corpus (default `<cwd>/knowledge`;
 *                           missing dir = empty corpus)
 *   MEMRAILS_AUTHORITY      file | postgres | dual (default file)
 *   MEMRAILS_PLANNER        heuristic | corpus | <registered> (default: eval-promoted)
 *
 * Self-hosted runtimes are unmetered by default (§5.8): usage reports zero
 * unless a meter is installed through `setRetrievalMeter`.
 */

// ── The core primitive & governed writes ───────────────────────────────────
export { retrieve } from '@/lib/memory/retrieve';
export { write } from '@/lib/memory/write';
export type { WriteInput, WriteResult } from '@/lib/memory/write';

// ── Governance lifecycle (§4 — every transition versioned + evented) ────────
export { supersede, dispute, restore, updateConfidence, forget } from '@/lib/memory/lifecycle';

// ── Registry & memory map ───────────────────────────────────────────────────
export { loadRegistry, getRecord, DEFAULT_SCOPE } from '@/lib/memory/registry';
export { memoryMap } from '@/lib/memory';

// ── Portability (§6) & projection (§7) ──────────────────────────────────────
export {
  exportRecords,
  importRecords,
  RECORD_MARKER,
  TOMBSTONE_MARKER,
} from '@/lib/memory/records';
export type { ExportOptions, ExportStats, ImportReport } from '@/lib/memory/records';
export { projectMarkdown } from '@/lib/memory/project-md';

// ── Telemetry & quality loop (C5) ───────────────────────────────────────────
export { recordFeedback, findRetrieval } from '@/lib/memory/telemetry';
export { reverifyStaleness } from '@/lib/memory/staleness';
export type { StalenessReport } from '@/lib/memory/staleness';
export { runEvals, meetsGates, earnsPromotion } from '@/lib/memory/evals';
export type { GoldenCase, EvalReport, EvalGates } from '@/lib/memory/evals';

// ── Planner seam (§9 / v0.1.1) ──────────────────────────────────────────────
export {
  planBranches,
  getPlanner,
  registerPlanner,
  heuristicPlanner,
  corpusPlanner,
  DEFAULT_PLANNER,
} from '@/lib/memory/planner';

// ── Metering seam (§5.8 — unmetered by default when self-hosted) ────────────
export { setRetrievalMeter } from '@/lib/memory/meter';
export type { RetrievalMeter } from '@/lib/memory/meter';

// ── Authority control (file | postgres | dual) ──────────────────────────────
export {
  authorityMode,
  ensureAuthorityReady,
  flushAuthority,
  closeDb,
} from '@/lib/memory/authority';

// ── Ledger (§8) ─────────────────────────────────────────────────────────────
export { readLedger } from '@/lib/ledger/events';

// ── Contract types ──────────────────────────────────────────────────────────
export type {
  ContextBundle,
  RetrieveInput,
  RetrievalMode,
  RetrievalTrace,
  BundleMemory,
  OmittedMemory,
  ScoreBreakdown,
} from '@/types/bundle';
export type {
  MemoryRecord,
  MemoryScope,
  MemoryStatus,
  MemoryType,
  MemoryVersion,
  MemorySourceRef,
  SensitivityLevel,
} from '@/types/governed';
export type { BranchPlan, BranchPlanner } from '@/types/planner';
export type { MemoryIndex, MemoryIndexNode, MemoryMapNode } from '@/types/index-tree';
export type { LedgerEvent } from '@/types/ledger';
export type { RetrievalUsage } from '@/types/billing';
