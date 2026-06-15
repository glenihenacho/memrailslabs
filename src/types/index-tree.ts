/**
 * MemoryIndex — a PageIndex-inspired hierarchical memory map.
 *
 * Agent memory is naturally hierarchical (owner → project → topic → decision →
 * evidence). The MemoryIndex stores that shape as nodes + edges so retrieval is
 * a reasoning tree-walk over relevant branches rather than flat vector top-k.
 */

export type NodeType = 'root' | 'topic' | 'branch' | 'leaf';

export type MemoryIndexNode = {
  node_id: string;
  owner_id: string;
  project_id: string;
  parent_node_id: string | null;
  node_type: NodeType;
  title: string;
  summary: string;
  /** Canonical path, e.g. `/project/memrails/retrieval_architecture`. */
  path: string;
  depth: number;
  status: 'active' | 'stale';
  member_ids: string[];
  created_at: string;
  updated_at: string;
};

export type MemoryIndexEdge = {
  edge_id: string;
  parent_node_id: string;
  child_node_id: string;
  edge_type: 'contains' | 'related' | 'contradicts';
  weight: number;
};

export type NodeMembership = {
  node_id: string;
  memory_id: string;
  relevance_score: number;
};

export type MemoryIndex = {
  nodes: MemoryIndexNode[];
  edges: MemoryIndexEdge[];
  memberships: NodeMembership[];
};

/** Serializable memory-map view for `/v1/projects/:id/memory-map`. */
export type MemoryMapNode = {
  path: string;
  title: string;
  summary: string;
  depth: number;
  status: 'active' | 'stale';
  memory_ids: string[];
  children: MemoryMapNode[];
};
