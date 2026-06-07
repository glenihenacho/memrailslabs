import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  query,
  inspect,
  PaymentRequired,
  EndpointNotFound,
  EndpointNotLive,
} from '@/lib/memory';
import { findClaim } from '@/lib/memory/corpus';
import { logEvent } from '@/lib/ledger/events';
import {
  QueryInputShape,
  InspectInputShape,
  WriteInputShape,
  SessionAuthorizeInputShape,
  SessionStatusInputShape,
  EndpointDeployInputShape,
  EndpointStatusInputShape,
} from '@/lib/memory/schema';
import { proposeRefactor } from '@/lib/refactor/proposals';
import { authorizeSession } from '@/lib/payments/sessions';
import { loadSession } from '@/lib/payments/store';
import { deployEndpoint } from '@/lib/endpoints/deploy';
import { loadEndpoint } from '@/lib/endpoints/store';
import type { PaymentRail } from '@/types/payments';

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

export type QueryArgs = {
  query: string;
  intent?: 'answer' | 'summarize' | 'compare' | 'extract' | 'refactor' | 'route';
  max_tokens?: number;
  session_id?: string;
  endpoint_id?: string;
  actor_id?: string;
};

export type InspectArgs = { packet_id: string };

export type WriteArgs = {
  claim: string;
  evidence?: string[];
  target_file?: string;
  stake?: number;
};

export type SessionAuthorizeArgs = {
  budget_cents: number;
  rail: PaymentRail;
  payer_agent_id?: string;
  endpoint_id?: string;
};

export type SessionStatusArgs = { session_id: string };

export type HarnessDeployArgs = {
  corpus_path?: string;
  payer_agent_id?: string;
};

export type HarnessStatusArgs = { endpoint_id: string };

function mcpActorId(args: QueryArgs): string {
  if (args.actor_id) return args.actor_id;
  const envActor = process.env.MEMRAILS_MCP_ACTOR_ID;
  if (envActor && envActor.length > 0) return envActor;
  return 'mcp:default';
}

export async function handleQuery(args: QueryArgs): Promise<ToolResult> {
  const actor_id = mcpActorId(args);
  logEvent(
    'MCP_TOOL_CALL',
    {
      tool: 'memory.query',
      input_preview: args.query.slice(0, 200),
      intent: args.intent ?? 'answer',
      session_id: args.session_id,
      endpoint_id: args.endpoint_id,
    },
    { actor_id, session_id: args.session_id },
  );
  try {
    const packet = await query({ ...args, actor_id });
    return { content: [{ type: 'text', text: JSON.stringify(packet, null, 2) }] };
  } catch (err) {
    if (err instanceof PaymentRequired) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { error: 'payment_required', reason: err.reason, session_id: err.session_id },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }
    if (err instanceof EndpointNotFound) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { error: 'endpoint_not_found', endpoint_id: err.endpoint_id },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }
    if (err instanceof EndpointNotLive) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: 'endpoint_not_live',
                endpoint_id: err.endpoint_id,
                status: err.status,
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }
    return errorResult(err);
  }
}

export async function handleHarnessDeploy(
  args: HarnessDeployArgs,
): Promise<ToolResult> {
  logEvent('MCP_TOOL_CALL', {
    tool: 'memory.harness.deploy',
    corpus_path: args.corpus_path ?? 'knowledge/',
  });
  try {
    const endpoint = await deployEndpoint(args);
    const body = {
      endpoint_id: endpoint.endpoint_id,
      url: endpoint.url,
      status: endpoint.status,
      corpus_keys: endpoint.corpus_keys,
      integrations: endpoint.integrations.map((i) => i.id),
      deploy_log: endpoint.deploy_log,
    };
    return { content: [{ type: 'text', text: JSON.stringify(body, null, 2) }] };
  } catch (err) {
    return errorResult(err);
  }
}

export async function handleHarnessStatus(args: HarnessStatusArgs): Promise<ToolResult> {
  logEvent('MCP_TOOL_CALL', {
    tool: 'memory.harness.status',
    endpoint_id: args.endpoint_id,
  });
  const endpoint = loadEndpoint(args.endpoint_id);
  if (!endpoint) {
    return {
      content: [{ type: 'text', text: `endpoint_not_found: ${args.endpoint_id}` }],
      isError: true,
    };
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(endpoint, null, 2) }],
  };
}

export async function handleSessionAuthorize(
  args: SessionAuthorizeArgs,
): Promise<ToolResult> {
  logEvent('MCP_TOOL_CALL', {
    tool: 'memory.session.authorize',
    rail: args.rail,
    budget_cents: args.budget_cents,
  });
  try {
    const session = authorizeSession(args);
    const body = {
      session_id: session.session_id,
      status: session.status,
      rail: session.rail,
      budget_cents: session.budget_cents,
      remaining_cents: session.budget_cents - session.spent_cents,
    };
    return { content: [{ type: 'text', text: JSON.stringify(body, null, 2) }] };
  } catch (err) {
    return errorResult(err);
  }
}

export async function handleSessionStatus(args: SessionStatusArgs): Promise<ToolResult> {
  logEvent('MCP_TOOL_CALL', {
    tool: 'memory.session.status',
    session_id: args.session_id,
  });
  const session = loadSession(args.session_id);
  if (!session) {
    return {
      content: [{ type: 'text', text: `session_not_found: ${args.session_id}` }],
      isError: true,
    };
  }
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          { ...session, remaining_cents: session.budget_cents - session.spent_cents },
          null,
          2,
        ),
      },
    ],
  };
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
  try {
    const proposal = proposeRefactor({
      claim: args.claim,
      evidence: args.evidence,
      target_file: args.target_file,
      stake: args.stake,
    });
    const body = {
      refactor_id: proposal.refactor_id,
      status: proposal.status,
      type: proposal.type,
      target_file: proposal.target_file,
      validator: proposal.validator,
    };
    return { content: [{ type: 'text', text: JSON.stringify(body, null, 2) }] };
  } catch (err) {
    return errorResult(err);
  }
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
        'Propose a refactor of canonical memory. Creates a reviewable ADD_CLAIM proposal; does not silently mutate.',
      inputSchema: WriteInputShape,
    },
    async (args) => handleWrite(args as WriteArgs),
  );

  server.registerTool(
    'memory.session.authorize',
    {
      description:
        'Authorize a payment session against a packet endpoint. Returns a session_id the agent can attach to subsequent memory.query calls; each packet is debited as an off-chain voucher.',
      inputSchema: SessionAuthorizeInputShape,
    },
    async (args) => handleSessionAuthorize(args as SessionAuthorizeArgs),
  );

  server.registerTool(
    'memory.session.status',
    {
      description:
        'Read the current PaymentSession (budget, spent, remaining, rail, status). Read-only.',
      inputSchema: SessionStatusInputShape,
    },
    async (args) => handleSessionStatus(args as SessionStatusArgs),
  );

  server.registerTool(
    'memory.harness.deploy',
    {
      description:
        'Deploy a managed harness endpoint: provisions OpenClaw, indexes the knowledge corpus, applies the pre-tuned config, binds Compress-v1, and wires the integration runtimes. Returns an Endpoint that memory.query can be routed through.',
      inputSchema: EndpointDeployInputShape,
    },
    async (args) => handleHarnessDeploy(args as HarnessDeployArgs),
  );

  server.registerTool(
    'memory.harness.status',
    {
      description:
        'Read a deployed Endpoint (url, status, corpus_keys, config, integrations, deploy log). Read-only.',
      inputSchema: EndpointStatusInputShape,
    },
    async (args) => handleHarnessStatus(args as HarnessStatusArgs),
  );
}
