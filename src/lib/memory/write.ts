import { randomUUID } from 'node:crypto';
import type {
  MemoryRecord,
  MemorySourceRef,
  MemoryType,
  SensitivityLevel,
} from '@/types/governed';
import { sha256 } from '@/lib/observability/hash';
import { logEvent } from '@/lib/ledger/events';
import { loadRegistry, invalidateRegistry, DEFAULT_SCOPE } from './registry';
import { appendWritten } from './store';
import { tokenize } from './ranking';

export type WriteInput = {
  owner_id?: string;
  project_id?: string;
  agent_id?: string;
  memory_type?: MemoryType;
  content: string;
  summary?: string;
  source?: MemorySourceRef;
  confidence?: number;
  sensitivity?: SensitivityLevel;
  tags?: string[];
  index_path?: string;
};

export type WriteResult = {
  memory_id: string;
  status: 'active' | 'deduplicated';
  dedup_of?: string;
  contradicts: string[];
};

function similarity(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let overlap = 0;
  for (const t of ta) if (tb.has(t)) overlap += 1;
  return overlap / Math.max(ta.size, tb.size);
}

const NEGATIONS = ['not', 'never', 'no', 'isn\'t', 'is not', 'instead', 'rather than'];

/**
 * `memory.write()` — governed memory creation.
 *
 * Writes the agent's own scoped memory as a governed JSONL record. It never
 * rewrites curated canonical markdown (CLAUDE.md Rule 4) — curated promotion is
 * a separate review step. Steps: validate → classify → dedupe → detect
 * contradiction → assign scope → create record → log → return memory_id.
 */
export function write(input: WriteInput): WriteResult {
  const content = input.content.trim();
  if (!content) throw new Error('content_required');

  const scope = {
    owner_id: input.owner_id ?? DEFAULT_SCOPE.owner_id,
    project_id: input.project_id ?? DEFAULT_SCOPE.project_id,
    agent_id: input.agent_id ?? DEFAULT_SCOPE.agent_id,
  };

  const registry = loadRegistry();
  const sameScope = registry.filter(
    (r) =>
      r.scope.owner_id === scope.owner_id &&
      r.scope.project_id === scope.project_id &&
      r.status === 'active',
  );

  // Dedupe: near-identical content in scope → return existing.
  const dup = sameScope.find((r) => similarity(r.content, content) >= 0.85);
  if (dup) {
    logEvent(
      'MEMORY_WRITTEN',
      { result: 'deduplicated', dedup_of: dup.memory_id },
      { memory_id: dup.memory_id, owner_id: scope.owner_id, project_id: scope.project_id },
    );
    return { memory_id: dup.memory_id, status: 'deduplicated', dedup_of: dup.memory_id, contradicts: [] };
  }

  // Contradiction: high topical overlap but a polarity/negation difference.
  const contradicts = sameScope
    .filter((r) => {
      const sim = similarity(r.content, content);
      if (sim < 0.4) return false;
      const aNeg = NEGATIONS.some((n) => content.toLowerCase().includes(n));
      const bNeg = NEGATIONS.some((n) => r.content.toLowerCase().includes(n));
      return aNeg !== bNeg;
    })
    .map((r) => r.memory_id);

  const memory_id = `mem_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const now = new Date().toISOString();
  const memory_type: MemoryType = input.memory_type ?? 'note';
  const tags = input.tags ?? [];
  const index_path =
    input.index_path ?? `/project/${scope.project_id}/${memory_type.toLowerCase()}`;

  const record: MemoryRecord = {
    memory_id,
    scope,
    memory_type,
    status: 'active',
    confidence: input.confidence ?? 0.8,
    sensitivity: input.sensitivity ?? 'normal',
    content,
    summary: input.summary ?? content.split(/(?<=[.!?])\s/)[0].slice(0, 220),
    tags,
    aliases: [],
    source_file: `data/federation/${scope.owner_id}/written.jsonl`,
    source_refs: [
      input.source ?? { type: 'api' },
      { type: 'conversation', hash: `sha256:${sha256(content)}` },
    ],
    contradictions: contradicts,
    index_path,
    current_version: 1,
    superseded_by: null,
    created_at: now,
    updated_at: now,
    expires_at: null,
  };

  appendWritten(record);
  invalidateRegistry();

  logEvent(
    'MEMORY_WRITTEN',
    {
      result: 'active',
      memory_type,
      contradicts,
      input_hash: sha256(content),
    },
    { memory_id, owner_id: scope.owner_id, project_id: scope.project_id, agent_id: scope.agent_id ?? undefined },
  );

  return { memory_id, status: 'active', contradicts };
}
