import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { GovernanceOverlay, GovernanceOverlayEntry } from '@/types/governed';
import { dataPath } from '@/lib/paths';
import { authorityMode } from './authority/mode';
import {
  snapshotLoadOverlay,
  snapshotSaveOverlay,
  snapshotUpsertOverlayEntry,
} from './authority/snapshot';
import { persistOverlayEntry } from './authority/persist';

/**
 * Governance authority layer.
 *
 * The canonical markdown stays immutable (CLAUDE.md Rule 1 + Rule 4). Mutable
 * governance state — status transitions, confidence overrides, supersede/dispute
 * pointers, version history — lives in the JSON overlay in `file`/`dual` modes
 * and in the PostgreSQL `memory_registry` + `memory_versions` tables in
 * `postgres` mode (conversion phase C2). `dual` shadows every overlay write
 * into Postgres while the file stays authoritative for the migration window.
 */

function overlayFile(): string {
  return dataPath('governance.json');
}

let cache: GovernanceOverlay | null = null;

export function loadOverlay(opts: { force?: boolean } = {}): GovernanceOverlay {
  // Postgres mode: the snapshot is the in-process view of the tables and is
  // always current for this process, so `force` has nothing to re-read.
  if (authorityMode() === 'postgres') return snapshotLoadOverlay();
  if (cache && !opts.force) return cache;
  const path = overlayFile();
  if (!existsSync(path)) {
    cache = {};
    return cache;
  }
  try {
    cache = JSON.parse(readFileSync(path, 'utf8')) as GovernanceOverlay;
  } catch (error) {
    // Fail loud: silently resetting to {} would let the next save overwrite the
    // canonical overlay and lose governance/version history irreversibly.
    throw new Error(`failed_to_parse_governance_overlay:${path}`, { cause: error });
  }
  return cache;
}

export function saveOverlay(overlay: GovernanceOverlay): void {
  const mode = authorityMode();
  if (mode === 'postgres') {
    snapshotSaveOverlay(overlay);
    return;
  }
  const path = overlayFile();
  if (!existsSync(dirname(path))) {
    mkdirSync(dirname(path), { recursive: true });
  }
  // Atomic write: a crash mid-write leaves the original overlay intact.
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(overlay, null, 2)}\n`, 'utf8');
  renameSync(tmp, path);
  cache = overlay;
  if (mode === 'dual') {
    for (const [memory_id, entry] of Object.entries(overlay)) {
      persistOverlayEntry(memory_id, entry);
    }
  }
}

export function getEntry(memory_id: string): GovernanceOverlayEntry | undefined {
  return loadOverlay()[memory_id];
}

export function upsertEntry(
  memory_id: string,
  patch: (current: GovernanceOverlayEntry) => GovernanceOverlayEntry,
): GovernanceOverlayEntry {
  if (authorityMode() === 'postgres') {
    const next = patch(snapshotLoadOverlay()[memory_id] ?? {});
    snapshotUpsertOverlayEntry(memory_id, next);
    return next;
  }
  const overlay = loadOverlay({ force: true });
  const next = patch(overlay[memory_id] ?? {});
  overlay[memory_id] = next;
  saveOverlay(overlay);
  return next;
}

export function overlayPath(): string {
  return overlayFile();
}
