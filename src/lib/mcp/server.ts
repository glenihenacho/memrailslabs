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
        'MemRails — knowledge density infrastructure for agentic software. Call memory.query first, inspect packets via memory.inspect, and browse canonical files through the memory://files resource. memory.write is registered but lands behavior in Phase 3.',
    },
  );
  registerTools(server);
  registerResources(server);
  return server;
}
