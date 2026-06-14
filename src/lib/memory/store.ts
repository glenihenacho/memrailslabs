import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { MemoryRecord } from '@/types/governed';
import { dataPath } from '@/lib/paths';

/**
 * Append-only store for agent-written memory.
 *
 * Curated knowledge lives in `/knowledge/**.md` (canonical, Git-versioned).
 * Agent-written memory lands here as governed JSONL records — still
 * inspectable, exportable, and version-controllable, but kept out of the
 * curated corpus so `memory.write()` never silently rewrites canonical files
 * (CLAUDE.md Rule 4). Both sources merge in the registry.
 */

function writtenFile(): string {
  return dataPath('written-memory.jsonl');
}

let cache: MemoryRecord[] | null = null;

export function readWritten(opts: { force?: boolean } = {}): MemoryRecord[] {
  if (cache && !opts.force) return cache;
  const path = writtenFile();
  if (!existsSync(path)) {
    cache = [];
    return cache;
  }
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
  cache = records;
  return cache;
}

export function appendWritten(record: MemoryRecord): void {
  const path = writtenFile();
  if (!existsSync(dirname(path))) {
    mkdirSync(dirname(path), { recursive: true });
  }
  appendFileSync(path, `${JSON.stringify(record)}\n`, 'utf8');
  if (cache) cache.push(record);
}

export function writtenPath(): string {
  return writtenFile();
}
