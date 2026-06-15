/**
 * Canonical MemRails rail registry.
 *
 * The rails are *capabilities*, not tiers. Each rail names a role, the plane it
 * lives on (global across tenants, or per-owner in the federation), the
 * file-canonical provider serving it today, and the target provider it graduates
 * to. The public API stays `memory.retrieve()` regardless.
 *
 *   Postgres governs, MemoryIndex retrieves, Redis accelerates, R2 preserves,
 *   and retrieval telemetry prices the system.
 *
 * Authority (Postgres) and Analytics (ClickHouse) are GLOBAL planes; the
 * federated NoSQL accounts (artifact/document) are PER-OWNER.
 */

export type RailScope = 'global' | 'per_owner';
export type RailStatus = 'active' | 'planned';
export type RailTier = 'v1' | 'v2';

export type RailId =
  | 'authority'
  | 'retrieval'
  | 'hot'
  | 'artifact'
  | 'telemetry'
  | 'vector'
  | 'graph'
  | 'analytics'
  | 'search'
  | 'document'
  | 'event'
  | 'realtime';

export type Rail = {
  id: RailId;
  name: string;
  role: string;
  scope: RailScope;
  tier: RailTier;
  status: RailStatus;
  /** File-canonical provider serving this rail in the MVP. */
  provider_mvp: string;
  /** Target provider this rail graduates to. */
  provider_target: string;
  /** For v2 rails: the measurable bottleneck that justifies adding it. */
  add_when?: string;
};

export const RAILS: Rail[] = [
  {
    id: 'authority',
    name: 'Authority Rail',
    role: 'owners, agents, projects, memory registry, policy, audit, metering',
    scope: 'global',
    tier: 'v1',
    status: 'active',
    provider_mvp: 'file:governance.json + accounts.json',
    provider_target: 'PostgreSQL (Neon / Supabase)',
  },
  {
    id: 'retrieval',
    name: 'Primary Retrieval Rail',
    role: 'PageIndex-style hierarchical memory retrieval',
    scope: 'per_owner',
    tier: 'v1',
    status: 'active',
    provider_mvp: 'MemoryIndex (in-process tree)',
    provider_target: 'MemoryIndex',
  },
  {
    id: 'hot',
    name: 'Hot Rail',
    role: 'cache, locks, hot retrieval state, recent context',
    scope: 'global',
    tier: 'v1',
    status: 'active',
    provider_mvp: 'memory:lru',
    provider_target: 'Redis (Upstash)',
  },
  {
    id: 'artifact',
    name: 'Artifact Rail',
    role: 'memory packets, evidence, exports, snapshots',
    scope: 'per_owner',
    tier: 'v1',
    status: 'active',
    provider_mvp: 'file:federation/<owner> + data/artifacts',
    provider_target: 'S3 / R2 / MinIO',
  },
  {
    id: 'telemetry',
    name: 'Telemetry Rail',
    role: 'retrieval logs, quality scores, billing events',
    scope: 'global',
    tier: 'v1',
    status: 'active',
    provider_mvp: 'file:logs/*.jsonl',
    provider_target: 'PostgreSQL first, ClickHouse later',
  },
  {
    id: 'vector',
    name: 'Vector Fallback Rail',
    role: 'broad fuzzy recall when MemoryIndex misses',
    scope: 'per_owner',
    tier: 'v2',
    status: 'planned',
    provider_mvp: 'none (tree-primary)',
    provider_target: 'pgvector → Qdrant',
    add_when: 'MemoryIndex misses broad fuzzy recall',
  },
  {
    id: 'graph',
    name: 'Graph / Provenance Rail',
    role: 'relationships, contradictions, causal chains',
    scope: 'global',
    tier: 'v2',
    status: 'planned',
    provider_mvp: 'none (contradictions inline)',
    provider_target: 'Neo4j',
    add_when: 'relationships / provenance become central',
  },
  {
    id: 'analytics',
    name: 'Analytics / Evals Rail',
    role: 'retrieval telemetry analytics and evals at scale',
    scope: 'global',
    tier: 'v2',
    status: 'planned',
    provider_mvp: 'none (Postgres/JSONL first)',
    provider_target: 'ClickHouse',
    add_when: 'telemetry outgrows Postgres',
  },
  {
    id: 'search',
    name: 'Search Rail',
    role: 'admin / debug keyword search',
    scope: 'global',
    tier: 'v2',
    status: 'planned',
    provider_mvp: 'Postgres FTS (planned)',
    provider_target: 'OpenSearch / Meilisearch',
    add_when: 'admin/debug search outgrows Postgres FTS',
  },
  {
    id: 'document',
    name: 'Packet / Document Rail',
    role: 'large JSON packets beyond JSONB / object storage',
    scope: 'per_owner',
    tier: 'v2',
    status: 'planned',
    provider_mvp: 'file:federation/<owner>',
    provider_target: 'Couchbase',
    add_when: 'JSON packets outgrow Postgres JSONB / object storage',
  },
  {
    id: 'event',
    name: 'Event / Timeline Rail',
    role: 'high-volume raw event spine',
    scope: 'global',
    tier: 'v2',
    status: 'planned',
    provider_mvp: 'file:logs/*.jsonl',
    provider_target: 'ScyllaDB',
    add_when: 'raw event volume becomes massive',
  },
  {
    id: 'realtime',
    name: 'Realtime Rail',
    role: 'client dashboard live sync',
    scope: 'per_owner',
    tier: 'v2',
    status: 'planned',
    provider_mvp: 'none',
    provider_target: 'Firestore / Couchbase Lite',
    add_when: 'live client sync becomes important',
  },
];

export function coreRails(): Rail[] {
  return RAILS.filter((r) => r.tier === 'v1');
}

export function activeRails(): Rail[] {
  return RAILS.filter((r) => r.status === 'active');
}

export function railsByScope(scope: RailScope): Rail[] {
  return RAILS.filter((r) => r.scope === scope);
}

export function getRail(id: RailId): Rail | undefined {
  return RAILS.find((r) => r.id === id);
}

export const CANONICAL_LINE =
  'Postgres governs, MemoryIndex retrieves, Redis accelerates, R2 preserves, and retrieval telemetry prices the system.';
