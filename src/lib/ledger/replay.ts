import type { GovernanceOverlay, GovernanceOverlayEntry } from '@/types/governed';
import type { LedgerEvent } from '@/types/ledger';
import { isGovernanceEvent } from './catalog';
import { readLedger } from './events';

/**
 * Governance replay — conversion phase C3.
 *
 * Every governance event carries `metadata.overlay_entry`: the full
 * resulting overlay entry after the change. Folding governance events in
 * stream order therefore reconstructs governance state exactly — last write
 * per memory_id wins, which matches how the overlay itself behaves. This is
 * the property every C4 rail leans on: any projection can be dropped and
 * rebuilt from the spine alone.
 */

/** Pure fold: events (oldest first) → governance overlay. */
export function replayGovernance(events: LedgerEvent[]): GovernanceOverlay {
  const overlay: GovernanceOverlay = {};
  for (const event of events) {
    if (!isGovernanceEvent(event.event_type)) continue;
    const entry = event.metadata?.overlay_entry as GovernanceOverlayEntry | undefined;
    const memory_id = event.memory_id ?? (event.metadata?.memory_id as string | undefined);
    if (!entry || !memory_id) continue; // pre-C3 events carry no replay payload
    overlay[memory_id] = entry;
  }
  return overlay;
}

/** Replay the active backend's ledger from zero into a governance overlay. */
export async function rebuildOverlayFromLedger(): Promise<GovernanceOverlay> {
  return replayGovernance(await readLedger());
}
