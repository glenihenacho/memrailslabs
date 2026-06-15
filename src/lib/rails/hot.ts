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
