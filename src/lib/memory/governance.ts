import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { GovernanceOverlay, GovernanceOverlayEntry } from '@/types/governed';
import { dataPath } from '@/lib/paths';

/**
 * File-canonical authority layer.
 *
 * The canonical markdown stays immutable (CLAUDE.md Rule 1 + Rule 4). Mutable
 * governance state — status transitions, confidence overrides, supersede/dispute
 * pointers, version history — lives in this JSON overlay. In production this
 * overlay is the PostgreSQL `memory_registry` + `memory_versions` tables.
 */

function overlayFile(): string {
  return dataPath('governance.json');
}

let cache: GovernanceOverlay | null = null;

export function loadOverlay(opts: { force?: boolean } = {}): GovernanceOverlay {
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
  const path = overlayFile();
  if (!existsSync(dirname(path))) {
    mkdirSync(dirname(path), { recursive: true });
  }
  // Atomic write: a crash mid-write leaves the original overlay intact.
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(overlay, null, 2)}\n`, 'utf8');
  renameSync(tmp, path);
  cache = overlay;
}

export function getEntry(memory_id: string): GovernanceOverlayEntry | undefined {
  return loadOverlay()[memory_id];
}

export function upsertEntry(
  memory_id: string,
  patch: (current: GovernanceOverlayEntry) => GovernanceOverlayEntry,
): GovernanceOverlayEntry {
  const overlay = loadOverlay({ force: true });
  const next = patch(overlay[memory_id] ?? {});
  overlay[memory_id] = next;
  saveOverlay(overlay);
  return next;
}

export function overlayPath(): string {
  return overlayFile();
}
