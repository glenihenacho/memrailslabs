import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ResourceTemplate,
  type McpServer,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  knowledgeDir,
  listKnowledgeFiles,
  loadCorpus,
} from '@/lib/memory/corpus';
import { logEvent } from '@/lib/ledger/events';

const FILES_SCHEME = 'memory://files/';
const KEYS_URI = 'memory://keys/index.json';

function resolveSafePath(relativePath: string): string | null {
  const root = knowledgeDir();
  const full = resolve(root, relativePath);
  // Guard against traversal — the resolved path must stay inside knowledge/.
  if (!full.startsWith(`${root}/`) && full !== root) return null;
  if (!existsSync(full)) return null;
  return full;
}

export function readFilesResource(uri: URL): {
  contents: Array<{ uri: string; mimeType: string; text: string }>;
} {
  logEvent('MCP_TOOL_CALL', { tool: 'resource.read', uri: uri.toString() });
  const href = uri.toString();
  if (!href.startsWith(FILES_SCHEME)) {
    throw new Error(`unsupported uri: ${href}`);
  }
  const relativePath = decodeURIComponent(href.slice(FILES_SCHEME.length));
  const full = resolveSafePath(relativePath);
  if (!full) {
    throw new Error(`not_found_or_outside_knowledge: ${relativePath}`);
  }
  return {
    contents: [
      {
        uri: href,
        mimeType: 'text/markdown',
        text: readFileSync(full, 'utf8'),
      },
    ],
  };
}

export function readKeysResource(uri: URL): {
  contents: Array<{ uri: string; mimeType: string; text: string }>;
} {
  logEvent('MCP_TOOL_CALL', { tool: 'resource.read', uri: uri.toString() });
  const index = loadCorpus().map((entry) => ({
    claim_id: entry.claim.id,
    aliases: entry.claim.aliases ?? [],
    tags: entry.claim.tags,
    source_file: entry.claim.source_file,
    confidence: entry.claim.confidence,
  }));
  return {
    contents: [
      {
        uri: uri.toString(),
        mimeType: 'application/json',
        text: JSON.stringify(index, null, 2),
      },
    ],
  };
}

export function registerResources(server: McpServer): void {
  const template = new ResourceTemplate('memory://files/{+path}', {
    list: async () => {
      logEvent('MCP_TOOL_CALL', { tool: 'resource.list', root: 'memory://files' });
      const files = listKnowledgeFiles();
      return {
        resources: files.map((rel) => {
          const knowledgeRoot = 'knowledge/';
          const inside = rel.startsWith(knowledgeRoot)
            ? rel.slice(knowledgeRoot.length)
            : rel;
          return {
            uri: `${FILES_SCHEME}${inside}`,
            name: inside,
            mimeType: 'text/markdown',
          };
        }),
      };
    },
  });

  server.registerResource(
    'memory-files',
    template,
    {
      description:
        'Read-only access to the canonical /knowledge markdown corpus. Each file is a separate resource URI.',
    },
    async (uri) => readFilesResource(uri),
  );

  server.registerResource(
    'memory-keys',
    KEYS_URI,
    {
      description:
        'Synthetic JSON index of every claim id, alias, tag, source file, and confidence in the corpus.',
      mimeType: 'application/json',
    },
    async (uri) => readKeysResource(uri),
  );
}
