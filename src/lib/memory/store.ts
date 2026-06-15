import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { MemoryRecord } from '@/types/governed';
import { dataPath } from '@/lib/paths';
import { namespaceDir } from '@/lib/federation/accounts';

/**
 * Agent-written memory, stored in the federated infrastructure plane — one
 * NoSQL account namespace per owner (`data/federation/<owner>/written.jsonl`).
 *
 * Curated knowledge lives in `/knowledge/**.md` (canonical, Git-versioned).
 * Agent-written memory lands in the owner's namespace as governed JSONL — still
 * inspectable, exportable, version-controllable, and kept out of the curated
 * corpus so `memory.write()` never rewrites canonical files (CLAUDE.md Rule 4).
 * Tenant isolation is physical: each owner's writes live in their own namespace.
 */

function namespaceFile(owner_id: string): string {
  return join(namespaceDir(owner_id), 'written.jsonl');
}

let cache: MemoryRecord[] | null = null;

function readNamespace(path: string): MemoryRecord[] {
  if (!existsSync(path)) return [];
  const records: MemoryRecord[] = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      records.push(JSON.parse(trimmed) as MemoryRecord);
    } catch {
      // Skip malformed lines — a bad row should not break the registry.
    }
  }
  return records;
}

/** Read across all owner namespaces. Government (scope) enforces access. */
export function readWritten(opts: { force?: boolean } = {}): MemoryRecord[] {
  if (cache && !opts.force) return cache;
  const base = dataPath('federation');
  if (!existsSync(base)) {
    cache = [];
    return cache;
  }
  const records: MemoryRecord[] = [];
  for (const owner of readdirSync(base)) {
    records.push(...readNamespace(namespaceFile(owner)));
  }
  cache = records;
  return cache;
}

export function appendWritten(record: MemoryRecord): void {
  const path = namespaceFile(record.scope.owner_id);
  if (!existsSync(namespaceDir(record.scope.owner_id))) {
    mkdirSync(namespaceDir(record.scope.owner_id), { recursive: true });
  }
  appendFileSync(path, `${JSON.stringify(record)}\n`, 'utf8');
  if (cache) cache.push(record);
}

export function writtenPath(owner_id: string): string {
  return namespaceFile(owner_id);
}
