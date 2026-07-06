/**
 * Hot Rail — an in-memory LRU cache (the MVP stand-in for Redis).
 *
 * Holds hot retrieval state so reads of recent retrievals hit memory before
 * scanning the telemetry JSONL. A real deploy swaps this for Upstash Redis
 * behind the same get/set/has interface; nothing above changes.
 */

export class HotRail<V = unknown> {
  private readonly map = new Map<string, V>();

  constructor(private readonly capacity = 256) {}

  get(key: string): V | undefined {
    const value = this.map.get(key);
    if (value === undefined) return undefined;
    // Refresh recency: re-insert to move to the end.
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}

/** Shared hot rail for retrieval bundles, keyed by retrieval_id. */
export const hotRetrievals = new HotRail(512);

// ── Hot memories rail (C4.1) ────────────────────────────────────────────────
// The Redis stand-in for `mode: 'hot'`: recent / high-usage memory ids ranked
// by usage then recency, fed by ledger events on the in-process bus and
// rebuildable from the spine (`hotMemoriesConsumer`). Invalidation is
// event-driven — a superseded, disputed, or tombstoned memory leaves the rail
// on its event, never on a TTL. A real deploy swaps the Map for Redis ZSET
// operations behind the same handler; the event feed does not change.

import type { LedgerEvent } from '@/types/ledger';
import type { GovernanceOverlayEntry } from '@/types/governed';
import { subscribe } from '@/lib/ledger/bus';
import type { LedgerConsumer } from '@/lib/ledger/consumers';

export type HotEntry = { memory_id: string; last_touch: string; uses: number };

export class HotMemoriesRail {
  private entries = new Map<string, HotEntry>();

  constructor(private readonly capacity = 512) {}

  /** One handler for both feeds: the live bus and the rebuild consumer. */
  handleEvent(event: LedgerEvent): void {
    const id = event.memory_id ?? (event.metadata?.memory_id as string | undefined);
    switch (event.event_type) {
      case 'MEMORY_WRITTEN': {
        if (event.metadata?.result === 'active' && id) this.touch(id, event.created_at, 0);
        break;
      }
      case 'MEMORY_RETRIEVED': {
        const ids = (event.metadata?.memory_ids as string[] | undefined) ?? []; // v2 payload
        for (const m of ids) this.touch(m, event.created_at, 1);
        break;
      }
      case 'MEMORY_RESTORED': {
        if (id) this.touch(id, event.created_at, 0);
        break;
      }
      case 'MEMORY_SUPERSEDED':
      case 'MEMORY_DISPUTED':
      case 'MEMORY_DELETED': {
        if (id) this.entries.delete(id); // invalidation on the event, not TTL
        break;
      }
      case 'MEMORY_GOVERNANCE_IMPORTED': {
        const entry = event.metadata?.overlay_entry as GovernanceOverlayEntry | undefined;
        if (id && entry?.status && entry.status !== 'active') this.entries.delete(id);
        break;
      }
      default:
        break;
    }
  }

  private touch(memory_id: string, at: string, useDelta: number): void {
    const cur = this.entries.get(memory_id);
    this.entries.set(memory_id, {
      memory_id,
      last_touch: cur && cur.last_touch > at ? cur.last_touch : at,
      uses: (cur?.uses ?? 0) + useDelta,
    });
    if (this.entries.size > this.capacity) {
      // Drop the coldest entry (fewest uses, oldest touch).
      const coldest = [...this.entries.values()].sort(
        (a, b) => a.uses - b.uses || a.last_touch.localeCompare(b.last_touch),
      )[0];
      if (coldest) this.entries.delete(coldest.memory_id);
    }
  }

  /** Hottest first: usage count, then recency of last touch. */
  hotIds(limit = 8): string[] {
    return [...this.entries.values()]
      .sort((a, b) => b.uses - a.uses || b.last_touch.localeCompare(a.last_touch))
      .slice(0, limit)
      .map((e) => e.memory_id);
  }

  has(memory_id: string): boolean {
    return this.entries.has(memory_id);
  }

  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }
}

/** Shared hot-memories projection, kept warm by the live bus. */
export const hotMemories = new HotMemoriesRail();
subscribe('hot_memories', (event) => hotMemories.handleEvent(event));

/** Rebuild feed: the same handler as a cursor-tracked ledger consumer. */
export function hotMemoriesConsumer(rail: HotMemoriesRail = hotMemories): LedgerConsumer {
  return { name: 'rail_hot_memories', handle: (event) => rail.handleEvent(event) };
}
