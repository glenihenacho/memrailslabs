import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { MemoryRecord } from '@/types/governed';
import { dataPath } from '@/lib/paths';
import { namespaceDir } from '@/lib/federation/accounts';
import { authorityMode } from './authority/mode';
import { snapshotAppendWritten, snapshotReadWritten } from './authority/snapshot';
import { persistWrittenRecord } from './authority/persist';

/**
 * Agent-written memory.
 *
 * File backend (`file` / `dual` modes): one NoSQL-account namespace per owner
 * (`data/federation/<owner>/written.jsonl`). Postgres backend (`postgres`
 * mode, C2): rows in `memory_registry`, served synchronously from the
 * authority snapshot. `dual` keeps the file authoritative for reads while
 * journaling every write into Postgres for the migration window.
 *
 * Curated knowledge lives in `/knowledge/**.md` (canonical, Git-versioned).
 * Agent-written memory stays out of the curated corpus so `memory.write()`
 * never rewrites canonical files (CLAUDE.md Rule 4). Tenant isolation is
 * physical in the file backend (per-owner namespaces) and scoped by the
 * owner/project columns in Postgres.
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
  if (authorityMode() === 'postgres') return snapshotReadWritten();
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
  const mode = authorityMode();
  if (mode === 'postgres') {
    // Snapshot updated synchronously; the serial journal persists to Postgres.
    snapshotAppendWritten(record);
    return;
  }
  const path = namespaceFile(record.scope.owner_id);
  if (!existsSync(namespaceDir(record.scope.owner_id))) {
    mkdirSync(namespaceDir(record.scope.owner_id), { recursive: true });
  }
  appendFileSync(path, `${JSON.stringify(record)}\n`, 'utf8');
  if (cache) cache.push(record);
  // Dual-run window: the file stays authoritative, Postgres shadows the write.
  if (mode === 'dual') persistWrittenRecord(record);
}

export function writtenPath(owner_id: string): string {
  return namespaceFile(owner_id);
}
