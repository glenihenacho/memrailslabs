import { basename } from 'node:path';
import type {
  GovernanceOverlayEntry,
  MemoryRecord,
  MemoryScope,
  MemoryType,
  SensitivityLevel,
} from '@/types/governed';
import { loadCorpus, type CorpusEntry } from './corpus';
import { loadOverlay } from './governance';
import { readWritten } from './store';

export const DEFAULT_SCOPE: Required<MemoryScope> = {
  owner_id: 'user_memrails',
  project_id: 'project_memrails',
  agent_id: 'agent_local_001',
};

const VALID_TYPES: MemoryType[] = [
  'decision',
  'preference',
  'note',
  'summary',
  'extraction',
  'correction',
  'constraint',
  'claim',
];

function str(data: Record<string, unknown>, key: string): string | undefined {
  return typeof data[key] === 'string' ? (data[key] as string) : undefined;
}

/** Derive a MemoryIndex path from frontmatter, else from file + first tag. */
function deriveIndexPath(entry: CorpusEntry, project: string): string {
  const explicit = str(entry.data, 'index_path');
  if (explicit) return explicit;
  const file = entry.claim.source_file;
  if (file.includes('/claims/')) {
    const topic = entry.claim.tags[0] ?? 'claims';
    return `/project/${project}/${topic.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`;
  }
  const base = basename(file, '.md').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  return `/project/${project}/${base}`;
}

function deriveSummary(entry: CorpusEntry): string {
  const explicit = str(entry.data, 'summary');
  if (explicit) return explicit;
  const claim = entry.claim.claim;
  // First sentence, capped.
  const firstSentence = claim.split(/(?<=[.!?])\s/)[0] ?? claim;
  return firstSentence.slice(0, 220);
}

/** Map a canonical corpus entry → governed registry record. */
function corpusToRecord(entry: CorpusEntry): MemoryRecord {
  const owner_id = str(entry.data, 'owner_id') ?? DEFAULT_SCOPE.owner_id;
  const project_id = str(entry.data, 'project_id') ?? DEFAULT_SCOPE.project_id;
  const agentRaw = str(entry.data, 'agent_id');
  const agent_id = agentRaw === undefined ? null : agentRaw;

  const typeRaw = str(entry.data, 'memory_type') as MemoryType | undefined;
  const memory_type: MemoryType = typeRaw && VALID_TYPES.includes(typeRaw) ? typeRaw : 'claim';

  const sensitivityRaw = str(entry.data, 'sensitivity') as SensitivityLevel | undefined;
  const sensitivity: SensitivityLevel = sensitivityRaw ?? 'normal';

  return {
    memory_id: entry.claim.id,
    scope: { owner_id, project_id, agent_id },
    memory_type,
    status: 'active',
    confidence: entry.claim.confidence,
    sensitivity,
    content: entry.claim.claim,
    summary: deriveSummary(entry),
    tags: entry.claim.tags,
    aliases: entry.claim.aliases ?? [],
    source_file: entry.claim.source_file,
    source_refs: [{ type: 'file', ref: entry.claim.source_file }],
    contradictions: entry.claim.contradictions ?? [],
    index_path: deriveIndexPath(entry, project_id),
    current_version: 1,
    superseded_by: null,
    created_at: entry.claim.created_at,
    updated_at: entry.claim.updated_at,
    expires_at: null,
  };
}

/** Apply the governance overlay on top of a base record. */
function applyOverlay(record: MemoryRecord, entry?: GovernanceOverlayEntry): MemoryRecord {
  if (!entry) return record;
  return {
    ...record,
    status: entry.status ?? record.status,
    confidence: entry.confidence ?? record.confidence,
    sensitivity: entry.sensitivity ?? record.sensitivity,
    superseded_by: entry.superseded_by ?? record.superseded_by,
    current_version: entry.versions ? entry.versions.length + 1 : record.current_version,
    updated_at:
      entry.versions && entry.versions.length > 0
        ? entry.versions[entry.versions.length - 1].created_at
        : record.updated_at,
  };
}

let cache: MemoryRecord[] | null = null;

/**
 * The full governed registry: curated markdown + agent-written records, each
 * overlaid with mutable governance state. This is the authority view that
 * retrieval, scoping, and the memory map read from.
 */
export function loadRegistry(opts: { force?: boolean } = {}): MemoryRecord[] {
  if (cache && !opts.force) return cache;

  const overlay = loadOverlay({ force: opts.force });
  const fromCorpus = loadCorpus({ force: opts.force }).map(corpusToRecord);
  const fromStore = readWritten({ force: opts.force });

  const all = [...fromCorpus, ...fromStore].map((r) => applyOverlay(r, overlay[r.memory_id]));
  cache = all;
  return cache;
}

export function getRecord(memory_id: string, opts: { force?: boolean } = {}): MemoryRecord | null {
  return loadRegistry(opts).find((r) => r.memory_id === memory_id) ?? null;
}

export function invalidateRegistry(): void {
  cache = null;
}
