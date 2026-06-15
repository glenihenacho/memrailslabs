import { randomUUID } from 'node:crypto';
import type { MemoryRecord } from '@/types/governed';
import type {
  MemoryIndex,
  MemoryIndexNode,
  MemoryMapNode,
  NodeMembership,
} from '@/types/index-tree';
import { tokenize } from './ranking';

function nid(path: string): string {
  return `node_${path.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`.replace(/_+/g, '_');
}

function titleFromPath(path: string): string {
  const last = path.split('/').filter(Boolean).pop() ?? 'root';
  return last
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Build the MemoryIndex from governed records. Each record's `index_path`
 * defines a leaf; ancestor branches are synthesized so the tree is fully
 * connected from the project root down. Memberships carry per-record relevance
 * to their node.
 */
export function buildIndex(records: MemoryRecord[]): MemoryIndex {
  const nodeByPath = new Map<string, MemoryIndexNode>();
  const memberships: NodeMembership[] = [];
  const now = new Date().toISOString();

  function ensureNode(path: string): MemoryIndexNode {
    const existing = nodeByPath.get(path);
    if (existing) return existing;
    const segments = path.split('/').filter(Boolean);
    const depth = segments.length;
    const parentPath = depth > 1 ? `/${segments.slice(0, -1).join('/')}` : null;
    const node: MemoryIndexNode = {
      node_id: nid(path),
      owner_id: 'user_memrails',
      project_id: 'project_memrails',
      parent_node_id: parentPath ? nid(parentPath) : null,
      node_type: depth <= 1 ? 'root' : 'topic',
      title: titleFromPath(path),
      summary: '',
      path,
      depth,
      status: 'active',
      member_ids: [],
      created_at: now,
      updated_at: now,
    };
    nodeByPath.set(path, node);
    if (parentPath) ensureNode(parentPath);
    return node;
  }

  for (const record of records) {
    const path = record.index_path || '/project/project_memrails/uncategorized';
    const node = ensureNode(path);
    node.owner_id = record.scope.owner_id;
    node.project_id = record.scope.project_id;
    node.node_type = 'branch';
    node.member_ids.push(record.memory_id);
    memberships.push({
      node_id: node.node_id,
      memory_id: record.memory_id,
      relevance_score: record.confidence,
    });
  }

  // Branch summaries: concatenate member summaries (trimmed).
  for (const node of nodeByPath.values()) {
    if (node.member_ids.length > 0) {
      const memberSummaries = records
        .filter((r) => node.member_ids.includes(r.memory_id))
        .map((r) => r.summary)
        .slice(0, 3);
      node.summary = memberSummaries.join(' · ').slice(0, 280);
    } else {
      node.summary = `${node.member_ids.length} memories under ${node.title}`;
    }
  }

  const nodes = [...nodeByPath.values()];
  const edges = nodes
    .filter((n) => n.parent_node_id)
    .map((n) => ({
      edge_id: `edge_${randomUUID().slice(0, 8)}`,
      parent_node_id: n.parent_node_id as string,
      child_node_id: n.node_id,
      edge_type: 'contains' as const,
      weight: 1,
    }));

  return { nodes, edges, memberships };
}

/**
 * Tree reasoning: score each branch node against the task context and return
 * the relevant branches, most relevant first. This is the PageIndex-style
 * tree-walk that replaces flat vector top-k.
 */
export function selectBranches(
  index: MemoryIndex,
  taskContext: string,
  opts: { limit?: number; threshold?: number } = {},
): { selected: MemoryIndexNode[]; rootsVisited: number } {
  const limit = opts.limit ?? 4;
  const threshold = opts.threshold ?? 0.0001;
  const taskTokens = new Set(tokenize(taskContext));

  const branchNodes = index.nodes.filter((n) => n.member_ids.length > 0);
  const scored = branchNodes.map((node) => {
    const haystack = new Set(tokenize(`${node.title} ${node.summary} ${node.path}`));
    let overlap = 0;
    for (const t of taskTokens) if (haystack.has(t)) overlap += 1;
    const score = taskTokens.size === 0 ? 0 : overlap / taskTokens.size;
    return { node, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const selected = scored.filter((s) => s.score > threshold).slice(0, limit).map((s) => s.node);

  return {
    selected: selected.length > 0 ? selected : branchNodes, // fall back to all branches
    rootsVisited: index.nodes.filter((n) => n.depth <= 2).length,
  };
}

/** Build the nested memory-map view for a project. */
export function toMemoryMap(index: MemoryIndex): MemoryMapNode[] {
  const byId = new Map(index.nodes.map((n) => [n.node_id, n]));
  const childrenOf = new Map<string | null, MemoryIndexNode[]>();
  for (const n of index.nodes) {
    const key = n.parent_node_id;
    const arr = childrenOf.get(key) ?? [];
    arr.push(n);
    childrenOf.set(key, arr);
  }

  function build(node: MemoryIndexNode): MemoryMapNode {
    const kids = (childrenOf.get(node.node_id) ?? []).map(build);
    return {
      path: node.path,
      title: node.title,
      summary: node.summary,
      depth: node.depth,
      status: node.status,
      memory_ids: node.member_ids,
      children: kids,
    };
  }

  const roots = (childrenOf.get(null) ?? []).filter((n) => byId.has(n.node_id));
  return roots.map(build);
}
