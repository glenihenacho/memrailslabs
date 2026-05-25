import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from '../src/lib/mcp/server';

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log readiness to stderr — stdout is reserved for the JSON-RPC stream.
  process.stderr.write('memrails mcp: ready on stdio\n');
}

main().catch((err) => {
  process.stderr.write(
    `memrails mcp: failed to start — ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
