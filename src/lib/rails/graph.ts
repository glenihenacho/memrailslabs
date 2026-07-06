/**
 * Graph projection (C4.3) — the auditor's map.
 *
 * A Neo4j-shaped projection of the memory graph, fed by ledger events:
 *
 *   nodes  — Memory, Source (hash-deduped), Agent, IndexNode. **No content
 *            on nodes** — ids and types only; content stays in the governed
 *            store behind policy.
 *   edges  — SUPERSEDED_BY, CONTRADICTS, DERIVED_FROM, HANGS_UNDER, CHANGED,
 *            each timestamped from the ledger event that created it.
 *
 * MERGE-idempotent: re-applying an event is a no-op, so the live bus feed
 * and a from-zero ledger replay converge on the identical graph (the
 * shadow-rebuild test diffs them). The MVP holds the graph in-process; a
 * real deploy swaps in Neo4j MERGE statements behind the same handler.
 *
 * One query surface, fixed menu (exposed as `memrails.memory.graph`):
 *   taint      — blast radius: what a bad memory could have contaminated
 *   ancestry   — the supersession lineage + change history of one memory
 *   clusters   — the connected component around a memory
 *   centrality — highest-degree memories (the load-bearing knowledge)
 */

import type { LedgerEvent } from '@/types/ledger';
import type { GovernanceOverlayEntry, MemorySourceRef } from '@/types/governed';
import { subscribe } from '@/lib/ledger/bus';
import type { LedgerConsumer } from '@/lib/ledger/consumers';

export type GraphNodeType = 'Memory' | 'Source' | 'Agent' | 'IndexNode';
export type GraphEdgeType = 'SUPERSEDED_BY' | 'CONTRADICTS' | 'DERIVED_FROM' | 'HANGS_UNDER' | 'CHANGED';

export type GraphNode = { id: string; type: GraphNodeType };
export type GraphEdge = { from: string; to: string; type: GraphEdgeType; at: string };

export type GraphQueryType = 'taint' | 'ancestry' | 'clusters' | 'centrality';

const GOVERNANCE_TYPES = new Set([
  'MEMORY_SUPERSEDED',
  'MEMORY_DISPUTED',
  'MEMORY_RESTORED',
  'MEMORY_CONFIDENCE_UPDATED',
  'MEMORY_DELETED',
  'MEMORY_GOVERNANCE_IMPORTED',
]);

function edgeKey(e: Omit<GraphEdge, 'at'>): string {
  return `${e.type}|${e.from}|${e.to}`;
}

export class GraphRail {
  readonly nodes = new Map<string, GraphNode>();
  readonly edges = new Map<string, GraphEdge>();

  /** MERGE semantics: create if absent, keep the first-seen timestamp. */
  private mergeNode(id: string, type: GraphNodeType): void {
    if (!this.nodes.has(id)) this.nodes.set(id, { id, type });
  }

  private mergeEdge(from: string, to: string, type: GraphEdgeType, at: string): void {
    const key = edgeKey({ from, to, type });
    if (!this.edges.has(key)) this.edges.set(key, { from, to, type, at });
  }

  /** One handler for both feeds: the live bus and the rebuild consumer. */
  handleEvent(event: LedgerEvent): void {
    const memory_id = event.memory_id ?? (event.metadata?.memory_id as string | undefined);
    const at = event.created_at;

    if (event.event_type === 'MEMORY_WRITTEN' && event.metadata?.result === 'active' && memory_id) {
      this.mergeNode(memory_id, 'Memory');
      if (event.agent_id) {
        this.mergeNode(`agent:${event.agent_id}`, 'Agent');
        this.mergeEdge(`agent:${event.agent_id}`, memory_id, 'CHANGED', at);
      }
      const refs = (event.metadata?.source_refs as MemorySourceRef[] | undefined) ?? []; // v2 payload
      for (const ref of refs) {
        if (!ref.hash) continue; // Source nodes are hash-deduped — no hash, no node
        this.mergeNode(`source:${ref.hash}`, 'Source');
        this.mergeEdge(memory_id, `source:${ref.hash}`, 'DERIVED_FROM', at);
      }
      const index_path = event.metadata?.index_path as string | undefined;
      if (index_path) {
        this.mergeNode(`index:${index_path}`, 'IndexNode');
        this.mergeEdge(memory_id, `index:${index_path}`, 'HANGS_UNDER', at);
      }
      for (const other of (event.metadata?.contradicts as string[] | undefined) ?? []) {
        this.mergeNode(other, 'Memory');
        this.mergeEdge(memory_id, other, 'CONTRADICTS', at);
      }
      return;
    }

    if (GOVERNANCE_TYPES.has(event.event_type) && memory_id) {
      this.mergeNode(memory_id, 'Memory');
      const entry = event.metadata?.overlay_entry as GovernanceOverlayEntry | undefined;
      const changed_by = entry?.versions?.[entry.versions.length - 1]?.changed_by;
      if (changed_by) {
        this.mergeNode(`agent:${changed_by}`, 'Agent');
        this.mergeEdge(`agent:${changed_by}`, memory_id, 'CHANGED', at);
      }
      const replacement = event.metadata?.replacement as string | undefined;
      if (event.event_type === 'MEMORY_SUPERSEDED' && replacement) {
        this.mergeNode(replacement, 'Memory');
        this.mergeEdge(memory_id, replacement, 'SUPERSEDED_BY', at);
      }
    }
  }

  clear(): void {
    this.nodes.clear();
    this.edges.clear();
  }

  /** Deterministic snapshot for shadow-rebuild diffs. */
  snapshot(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    return {
      nodes: [...this.nodes.values()].sort((a, b) => a.id.localeCompare(b.id)),
      edges: [...this.edges.values()].sort((a, b) => edgeKey(a).localeCompare(edgeKey(b))),
    };
  }

  private neighbors(): Map<string, GraphEdge[]> {
    const adj = new Map<string, GraphEdge[]>();
    for (const e of this.edges.values()) {
      for (const end of [e.from, e.to]) {
        const list = adj.get(end) ?? [];
        list.push(e);
        adj.set(end, list);
      }
    }
    return adj;
  }

  /**
   * Taint: the blast radius of a bad memory. Contamination flows to its
   * replacements (SUPERSEDED_BY), to what it contradicts (both directions),
   * and to memories derived from the same sources (via shared Source nodes).
   */
  taint(root_id: string, depth = 3): { root: string; reached: Array<{ id: string; depth: number; via: string }> } {
    const adj = this.neighbors();
    const reached: Array<{ id: string; depth: number; via: string }> = [];
    const seen = new Set<string>([root_id]);
    let frontier = [root_id];
    for (let d = 1; d <= depth && frontier.length > 0; d += 1) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const e of adj.get(id) ?? []) {
          if (e.type === 'HANGS_UNDER' || e.type === 'CHANGED') continue; // structure/audit, not contamination
          const other = e.from === id ? e.to : e.from;
          if (e.type === 'SUPERSEDED_BY' && e.from !== id) continue; // taint flows forward to replacements only
          if (seen.has(other)) continue;
          seen.add(other);
          next.push(other);
          if (this.nodes.get(other)?.type !== 'Source') {
            reached.push({ id: other, depth: d, via: e.type });
          }
        }
      }
      frontier = next;
    }
    return { root: root_id, reached };
  }

  /** Ancestry: the supersession chain through a memory, plus who changed it. */
  ancestry(root_id: string, depth = 10): {
    root: string;
    chain: Array<{ id: string; superseded_by?: string; at?: string }>;
    changed_by: Array<{ agent: string; at: string }>;
  } {
    const forward = new Map<string, GraphEdge>();
    const backward = new Map<string, GraphEdge>();
    for (const e of this.edges.values()) {
      if (e.type !== 'SUPERSEDED_BY') continue;
      forward.set(e.from, e);
      backward.set(e.to, e);
    }
    // Walk back to the origin of the chain, then forward through every hop.
    let origin = root_id;
    for (let i = 0; i < depth && backward.has(origin); i += 1) origin = backward.get(origin)!.from;
    const chain: Array<{ id: string; superseded_by?: string; at?: string }> = [];
    let cursor: string | undefined = origin;
    for (let i = 0; i <= depth && cursor; i += 1) {
      const hop = forward.get(cursor);
      chain.push({ id: cursor, superseded_by: hop?.to, at: hop?.at });
      cursor = hop?.to;
    }
    const changed_by = [...this.edges.values()]
      .filter((e) => e.type === 'CHANGED' && chain.some((c) => c.id === e.to))
      .map((e) => ({ agent: e.from.replace(/^agent:/, ''), at: e.at }))
      .sort((a, b) => a.at.localeCompare(b.at));
    return { root: root_id, chain, changed_by };
  }

  /** Clusters: the connected component around a memory (undirected). */
  clusters(root_id: string, depth = 5): { root: string; members: string[]; size: number } {
    const adj = this.neighbors();
    const seen = new Set<string>([root_id]);
    let frontier = [root_id];
    for (let d = 0; d < depth && frontier.length > 0; d += 1) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const e of adj.get(id) ?? []) {
          const other = e.from === id ? e.to : e.from;
          if (!seen.has(other)) {
            seen.add(other);
            next.push(other);
          }
        }
      }
      frontier = next;
    }
    const members = [...seen].filter((id) => this.nodes.get(id)?.type === 'Memory').sort();
    return { root: root_id, members, size: members.length };
  }

  /** Centrality: degree-ranked Memory nodes — the load-bearing knowledge. */
  centrality(limit = 10): Array<{ id: string; degree: number }> {
    const degree = new Map<string, number>();
    for (const e of this.edges.values()) {
      for (const end of [e.from, e.to]) {
        if (this.nodes.get(end)?.type === 'Memory') {
          degree.set(end, (degree.get(end) ?? 0) + 1);
        }
      }
    }
    return [...degree.entries()]
      .map(([id, d]) => ({ id, degree: d }))
      .sort((a, b) => b.degree - a.degree || a.id.localeCompare(b.id))
      .slice(0, limit);
  }
}

/** Shared graph projection, kept warm by the live bus. */
export const graphRail = new GraphRail();
subscribe('graph_rail', (event) => graphRail.handleEvent(event));

/** Rebuild feed: the same handler as a cursor-tracked ledger consumer. */
export function graphConsumer(rail: GraphRail = graphRail): LedgerConsumer {
  return { name: 'rail_graph', handle: (event) => rail.handleEvent(event) };
}

/** Fixed query menu — the single dispatch surface behind `memrails.memory.graph`. */
export function graphQuery(
  query_type: GraphQueryType,
  root_id?: string,
  depth?: number,
  rail: GraphRail = graphRail,
): unknown {
  switch (query_type) {
    case 'taint':
      if (!root_id) throw new Error('root_id_required');
      return rail.taint(root_id, depth ?? 3);
    case 'ancestry':
      if (!root_id) throw new Error('root_id_required');
      return rail.ancestry(root_id, depth ?? 10);
    case 'clusters':
      if (!root_id) throw new Error('root_id_required');
      return rail.clusters(root_id, depth ?? 5);
    case 'centrality':
      return rail.centrality(depth ?? 10);
    default:
      throw new Error(`unknown_graph_query:${query_type}`);
  }
}
