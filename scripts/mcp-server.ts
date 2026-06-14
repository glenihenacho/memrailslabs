#!/usr/bin/env tsx
/**
 * Minimal MCP-style stdio server for MemRails.
 *
 * Speaks newline-delimited JSON-RPC over stdin/stdout. This is a transport stub
 * around the in-process tool dispatcher (`src/lib/mcp/tools.ts`); swap it for
 * `@modelcontextprotocol/sdk` when wiring a production MCP client. Supports:
 *   - `tools/list`  → returns MCP_TOOLS
 *   - `tools/call`  → { name, arguments } → dispatchTool result
 *
 * Try it:
 *   echo '{"id":1,"method":"tools/list"}' | npm run -s mcp:server
 *   echo '{"id":2,"method":"tools/call","params":{"name":"memrails.memory.retrieve","arguments":{"task_context":"roadmap"}}}' | npm run -s mcp:server
 */
import { createInterface } from 'node:readline';
import { MCP_TOOLS, dispatchTool } from '@/lib/mcp/tools';

const rl = createInterface({ input: process.stdin });

function reply(obj: unknown) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg: { id?: unknown; method?: string; params?: { name?: string; arguments?: Record<string, unknown> } };
  try {
    msg = JSON.parse(trimmed);
  } catch {
    reply({ error: 'invalid_json' });
    return;
  }
  try {
    if (msg.method === 'tools/list') {
      reply({ id: msg.id, result: { tools: MCP_TOOLS } });
    } else if (msg.method === 'tools/call') {
      const result = await dispatchTool(msg.params?.name ?? '', msg.params?.arguments ?? {});
      reply({ id: msg.id, result });
    } else {
      reply({ id: msg.id, error: `unknown_method:${msg.method}` });
    }
  } catch (err) {
    reply({ id: msg.id, error: (err as Error).message });
  }
});
