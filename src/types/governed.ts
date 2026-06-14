/**
 * Governed memory model.
 *
 * Reconciles the packet/L1–L5 system (see `packet.ts`) with the governed
 * `memory.retrieve()` architecture. A {@link MemoryRecord} is the registry
 * wrapper around a file-canonical claim: it carries scope, status, sensitivity,
 * and version pointers so retrieval can be governed, auditable, and explainable.
 *
 * SQL is the eventual authority layer (see `knowledge/data-model.md`). In this
 * file-canonical MVP the authority is a JSON overlay (`data/governance.json`)
 * layered over the markdown corpus, so the canonical `.md` files are never
 * silently mutated (CLAUDE.md Rule 1 + Rule 4).
 */

export type MemoryStatus = 'active' | 'superseded' | 'disputed' | 'tombstoned';

export type SensitivityLevel = 'normal' | 'sensitive' | 'restricted';

export type MemoryType =
  | 'decision'
  | 'preference'
  | 'note'
  | 'summary'
  | 'extraction'
  | 'correction'
  | 'constraint'
  | 'claim';

/** Owner → project → agent scope triple. Agent is optional (project-wide). */
export type MemoryScope = {
  owner_id: string;
  project_id: string;
  agent_id?: string | null;
};

export type MemorySourceRef = {
  type: 'conversation' | 'file' | 'tool_result' | 'manual' | 'api' | 'correction';
  id?: string;
  ref?: string;
  hash?: string;
};

/**
 * Registry row. Mirrors the `memory_registry` + `memory_packets` tables from
 * the production data model, collapsed for the file-canonical MVP.
 */
export type MemoryRecord = {
  memory_id: string;
  scope: MemoryScope;
  memory_type: MemoryType;
  status: MemoryStatus;
  confidence: number;
  sensitivity: SensitivityLevel;
  /** Canonical, human-readable body (markdown-backed). */
  content: string;
  /** One-line, retrieval-facing summary. */
  summary: string;
  tags: string[];
  aliases: string[];
  source_file: string;
  source_refs: MemorySourceRef[];
  contradictions: string[];
  /** MemoryIndex node this record currently hangs under. */
  index_path: string;
  current_version: number;
  superseded_by?: string | null;
  created_at: string;
  updated_at: string;
  expires_at?: string | null;
};

export type MemoryVersion = {
  version_id: string;
  memory_id: string;
  version_number: number;
  change_type:
    | 'CREATE'
    | 'UPDATE_CONFIDENCE'
    | 'SUPERSEDE'
    | 'DISPUTE'
    | 'RESTORE'
    | 'TOMBSTONE';
  changed_by: string;
  diff_summary: string;
  source_event_id?: string;
  created_at: string;
};

/**
 * Governance overlay persisted to `data/governance.json`. Keyed by memory_id.
 * Anything not present here falls back to the canonical markdown frontmatter.
 */
export type GovernanceOverlayEntry = {
  status?: MemoryStatus;
  confidence?: number;
  sensitivity?: SensitivityLevel;
  superseded_by?: string | null;
  disputed_reason?: string;
  tombstoned_at?: string;
  versions?: MemoryVersion[];
};

export type GovernanceOverlay = Record<string, GovernanceOverlayEntry>;
