import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools } from './tools';
import { registerResources } from './resources';

export function createServer(): McpServer {
  const server = new McpServer(
    { name: 'memrails', version: '0.1.0' },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
      instructions:
        'MemRails — knowledge density infrastructure for agentic software. Call memory.query first, inspect packets via memory.inspect, propose canonical-memory changes via memory.write (returns a reviewable proposal, never mutates silently), and browse canonical files through the memory://files resource.',
    },
  );
  registerTools(server);
  registerResources(server);
  return server;
}
