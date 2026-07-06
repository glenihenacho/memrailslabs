/**
 * MCP tool surface for MemRails.
 *
 * Exposes the governed memory primitives as agent-native tools. The dispatcher
 * runs in-process against the file-canonical lib; a transport (stdio / HTTP MCP
 * server) wraps `dispatchTool` — see `scripts/mcp-server.ts`.
 */

import { retrieve } from '@/lib/memory/retrieve';
import { write } from '@/lib/memory/write';
import { findRetrieval } from '@/lib/memory/telemetry';
import { memoryMap } from '@/lib/memory';
import { projectMarkdown } from '@/lib/memory/project-md';
import { graphQuery, type GraphQueryType } from '@/lib/rails/graph';
import { ensureAuthorityReady, flushAuthority } from '@/lib/memory/authority';
// Side-effect import: installs the billing meter so MCP retrievals stay billed.
import '@/lib/billing/meter';

export type McpTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export const MCP_TOOLS: McpTool[] = [
  {
    name: 'memrails.memory.retrieve',
    description: 'Retrieve governed memory for local inference. Returns a scoped, explainable context bundle.',
    input_schema: {
      type: 'object',
      required: ['task_context'],
      properties: {
        task_context: { type: 'string' },
        project_id: { type: 'string' },
        agent_id: { type: 'string' },
        max_tokens: { type: 'number' },
        retrieval_mode: { type: 'string', enum: ['exact', 'tree', 'hybrid', 'hot', 'debug'] },
      },
    },
  },
  {
    name: 'memrails.memory.write',
    description: 'Write a governed memory record (deduped, contradiction-checked). Never rewrites canonical markdown.',
    input_schema: {
      type: 'object',
      required: ['content'],
      properties: {
        content: { type: 'string' },
        memory_type: { type: 'string' },
        confidence: { type: 'number' },
        tags: { type: 'array', items: { type: 'string' } },
        project_id: { type: 'string' },
      },
    },
  },
  {
    name: 'memrails.memory.inspect',
    description: 'Inspect a prior retrieval by retrieval_id: trace, branches selected, scores, and omissions.',
    input_schema: {
      type: 'object',
      required: ['retrieval_id'],
      properties: { retrieval_id: { type: 'string' } },
    },
  },
  {
    name: 'memrails.memory.map',
    description: 'Return the project MemoryIndex tree (nested memory map).',
    input_schema: {
      type: 'object',
      properties: { project_id: { type: 'string' } },
    },
  },
  {
    name: 'memrails.memory.project',
    description:
      'Project the governed store into a derived memrails.md (contract §7): sections by memory type, floor-filtered, restricted excluded, trace footer.',
    input_schema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        agent_id: { type: 'string' },
        include_sensitive: { type: 'boolean' },
      },
    },
  },
  {
    name: 'memrails.memory.graph',
    description:
      "Query the graph projection (the auditor's map — structure only, never content). Fixed menu: taint (blast radius), ancestry (supersession lineage), clusters (connected component), centrality (load-bearing memories).",
    input_schema: {
      type: 'object',
      required: ['query_type'],
      properties: {
        query_type: { type: 'string', enum: ['taint', 'ancestry', 'clusters', 'centrality'] },
        root_id: { type: 'string' },
        depth: { type: 'number' },
      },
    },
  },
];

/** Dispatch an MCP tool call to the governed lib. Read-only by default. */
export async function dispatchTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  // Hydrate the Postgres authority snapshot before the first synchronous read
  // and confirm any write is durable before responding. Both no-op in file mode.
  await ensureAuthorityReady();
  try {
    return await dispatchToolInner(name, args);
  } finally {
    await flushAuthority();
  }
}

async function dispatchToolInner(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'memrails.memory.retrieve':
      return retrieve({
        task_context: String(args.task_context ?? ''),
        project_id: args.project_id as string | undefined,
        agent_id: args.agent_id as string | undefined,
        max_tokens: args.max_tokens as number | undefined,
        retrieval_mode: args.retrieval_mode as never,
        include_evidence: args.include_evidence as boolean | undefined,
      });
    case 'memrails.memory.write':
      return write({
        content: String(args.content ?? ''),
        memory_type: args.memory_type as never,
        confidence: args.confidence as number | undefined,
        tags: args.tags as string[] | undefined,
        project_id: args.project_id as string | undefined,
      });
    case 'memrails.memory.inspect': {
      const bundle = findRetrieval(String(args.retrieval_id ?? ''));
      if (!bundle) throw new Error('retrieval_not_found');
      return { trace: bundle.retrieval_trace, memories: bundle.memories, omitted: bundle.omitted };
    }
    case 'memrails.memory.map':
      return memoryMap((args.project_id as string) ?? 'project_memrails');
    case 'memrails.memory.project':
      return projectMarkdown({
        project_id: args.project_id as string | undefined,
        agent_id: (args.agent_id as string | undefined) ?? null,
        include_sensitive: args.include_sensitive as boolean | undefined,
      });
    case 'memrails.memory.graph':
      return graphQuery(
        args.query_type as GraphQueryType,
        args.root_id as string | undefined,
        args.depth as number | undefined,
      );
    default:
      throw new Error(`unknown_tool:${name}`);
  }
}
