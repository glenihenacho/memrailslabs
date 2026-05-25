import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { query, inspect } from '@/lib/memory';
import { findClaim } from '@/lib/memory/corpus';
import { logEvent } from '@/lib/ledger/events';
import {
  QueryInputShape,
  InspectInputShape,
  WriteInputShape,
} from '@/lib/memory/schema';

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

export type QueryArgs = {
  query: string;
  intent?: 'answer' | 'summarize' | 'compare' | 'extract' | 'refactor' | 'route';
  max_tokens?: number;
};

export type InspectArgs = { packet_id: string };

export type WriteArgs = {
  claim: string;
  evidence?: string[];
  target_file?: string;
  stake?: number;
};

export async function handleQuery(args: QueryArgs): Promise<ToolResult> {
  logEvent('MCP_TOOL_CALL', {
    tool: 'memory.query',
    input_preview: args.query.slice(0, 200),
    intent: args.intent ?? 'answer',
  });
  try {
    const packet = await query(args);
    return { content: [{ type: 'text', text: JSON.stringify(packet, null, 2) }] };
  } catch (err) {
    return errorResult(err);
  }
}

export async function handleInspect(args: InspectArgs): Promise<ToolResult> {
  logEvent('MCP_TOOL_CALL', {
    tool: 'memory.inspect',
    packet_id: args.packet_id,
  });
  try {
    const packet = inspect(args.packet_id);
    if (!packet) {
      return {
        content: [{ type: 'text', text: `packet_not_found: ${args.packet_id}` }],
        isError: true,
      };
    }
    const evidence_bundle = packet.evidence
      .map((e) => findClaim(e.claim_id))
      .filter((c): c is NonNullable<typeof c> => c !== null);
    const provenance_weights = Object.fromEntries(
      packet.evidence.map((e) => [e.claim_id, e.weight]),
    );
    const result = {
      packet,
      evidence_bundle,
      provenance_weights,
      hashes: {
        input_hash: packet.input_hash,
        output_hash: packet.output_hash,
      },
    };
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return errorResult(err);
  }
}

export async function handleWrite(args: WriteArgs): Promise<ToolResult> {
  logEvent('MCP_TOOL_CALL', {
    tool: 'memory.write',
    claim_preview: args.claim.slice(0, 200),
    target_file: args.target_file,
  });
  return {
    content: [
      {
        type: 'text',
        text: 'memory.write is not implemented yet. Refactor proposals land in Phase 3 (constitution §14). Until then this tool is registered so MCP clients see the contract, but invocation returns this notice.',
      },
    ],
    isError: true,
  };
}

function errorResult(err: unknown): ToolResult {
  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: 'text', text: `error: ${message}` }],
    isError: true,
  };
}

export function registerTools(server: McpServer): void {
  server.registerTool(
    'memory.query',
    {
      description:
        'Run a query through the MemRails L1–L5 retrieval stack. Returns a packet with provenance, hashes, and contradictions.',
      inputSchema: QueryInputShape,
    },
    async (args) => handleQuery(args as QueryArgs),
  );

  server.registerTool(
    'memory.inspect',
    {
      description:
        'Open packet lineage. Returns the stored packet, full evidence bundle, provenance weights, and hashes.',
      inputSchema: InspectInputShape,
    },
    async (args) => handleInspect(args as InspectArgs),
  );

  server.registerTool(
    'memory.write',
    {
      description:
        'Propose a refactor of canonical memory (Phase 3). Registered for contract visibility; currently returns a 501-style error.',
      inputSchema: WriteInputShape,
    },
    async (args) => handleWrite(args as WriteArgs),
  );
}
