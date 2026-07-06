/**
 * Postgres authority schema — conversion phase C2, per `knowledge/data-model.md`.
 *
 * `memory_registry` + `memory_versions` are the grown-up form of the
 * `data/governance.json` overlay: one row per governed memory (written
 * records carry their full body in `record`; corpus-origin rows carry
 * governance only — the markdown stays a load source until it is demoted to
 * a projection). `ledger_events` and `retrievals` are created now and
 * populated in C3 when the ledger becomes the event spine.
 *
 * Plain Postgres SQL throughout — the embedded PGlite engine and a hosted
 * pg-wire server run the same DDL.
 *
 * pgvector: added in C5 as the `hybrid` fallback rail; PGlite loads the
 * vector extension at that point. Nothing here depends on it.
 */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS memory_registry (
  memory_id      text PRIMARY KEY,
  origin         text NOT NULL DEFAULT 'written' CHECK (origin IN ('written', 'corpus')),
  owner_id       text,
  project_id     text,
  agent_id       text,
  status         text,
  confidence     double precision,
  sensitivity    text,
  superseded_by  text,
  disputed_reason text,
  tombstoned_at  timestamptz,
  -- Full MemoryRecord body for written records; NULL for corpus governance rows.
  record         jsonb,
  -- GovernanceOverlayEntry (minus versions, which are normalized below);
  -- NULL when the row carries no overlay state.
  overlay        jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS memory_registry_scope_idx
  ON memory_registry (owner_id, project_id);
CREATE INDEX IF NOT EXISTS memory_registry_status_idx
  ON memory_registry (status);

CREATE TABLE IF NOT EXISTS memory_versions (
  version_id      text PRIMARY KEY,
  memory_id       text NOT NULL,
  version_number  integer NOT NULL,
  change_type     text NOT NULL,
  changed_by      text,
  diff_summary    text,
  source_event_id text,
  created_at      timestamptz NOT NULL,
  UNIQUE (memory_id, version_number)
);
CREATE INDEX IF NOT EXISTS memory_versions_memory_idx
  ON memory_versions (memory_id);

CREATE TABLE IF NOT EXISTS memory_sources (
  memory_id  text NOT NULL,
  seq        integer NOT NULL,
  type       text NOT NULL,
  source_id  text,
  ref        text,
  hash       text,
  PRIMARY KEY (memory_id, seq)
);

CREATE TABLE IF NOT EXISTS contradiction_edges (
  from_memory_id text NOT NULL,
  to_memory_id   text NOT NULL,
  PRIMARY KEY (from_memory_id, to_memory_id)
);

-- The event spine (C3): every governance change lands here in the same
-- transaction as its registry write; rails (C4+) consume in seq order.
CREATE TABLE IF NOT EXISTS ledger_events (
  seq            bigserial UNIQUE,
  event_id       text PRIMARY KEY,
  event_type     text NOT NULL,
  schema_version integer NOT NULL DEFAULT 1,
  event          jsonb NOT NULL,
  created_at     timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS ledger_events_type_idx
  ON ledger_events (event_type);
-- Upgrade path for authorities created by the C2 schema.
ALTER TABLE ledger_events ADD COLUMN IF NOT EXISTS seq bigserial UNIQUE;
ALTER TABLE ledger_events ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1;

-- Consumer cursors (C3): each projection tracks how far along the spine it
-- has read; idempotence is by event_id, ordering by seq.
CREATE TABLE IF NOT EXISTS ledger_cursors (
  consumer   text PRIMARY KEY,
  last_seq   bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS retrievals (
  retrieval_id text PRIMARY KEY,
  bundle       jsonb NOT NULL,
  created_at   timestamptz NOT NULL
);

-- Training corpus (C5.4): structure and decisions of every retrieval —
-- hashed task context, branch plan, full score breakdowns, what was
-- returned/omitted, whether the vector fallback fired, and (updated later)
-- the feedback outcome. Never memory content (contract v0.1 s9). This is
-- what the C6 planner trains on.
CREATE TABLE IF NOT EXISTS retrieval_training (
  retrieval_id      text PRIMARY KEY,
  task_context_hash text NOT NULL,
  mode              text NOT NULL,
  branches          jsonb NOT NULL,
  scoring           jsonb NOT NULL,
  returned_ids      jsonb NOT NULL,
  omitted           jsonb NOT NULL,
  vector_fallback   boolean NOT NULL DEFAULT false,
  outcome           jsonb,
  created_at        timestamptz NOT NULL
);

-- Artifact rail pointers (C4.2): the blob store holds content-addressed,
-- encrypted bodies; Postgres stores pointers only.
CREATE TABLE IF NOT EXISTS artifacts (
  ref        text PRIMARY KEY,
  hash       text NOT NULL,
  owner_id   text,
  bytes      integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS artifacts_hash_idx ON artifacts (hash);
`;
