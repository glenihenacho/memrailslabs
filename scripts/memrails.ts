#!/usr/bin/env tsx
/**
 * MemRails CLI — in-process governed memory for local agents.
 *
 *   npm run memrails -- retrieve --project project_memrails --context "build the roadmap"
 *   npm run memrails -- write --content "..." --type decision --confidence 0.95
 *   npm run memrails -- map --project project_memrails
 *   npm run memrails -- inspect --retrieval ret_xxx
 */
import { retrieve } from '@/lib/memory/retrieve';
import { write } from '@/lib/memory/write';
import { findRetrieval } from '@/lib/memory/telemetry';
import { memoryMap } from '@/lib/memory';
import type { RetrievalMode } from '@/types/bundle';

function flag(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function main() {
  const cmd = process.argv[2];
  switch (cmd) {
    case 'retrieve': {
      const bundle = retrieve({
        task_context: flag('context') ?? flag('c') ?? '',
        project_id: flag('project'),
        agent_id: flag('agent'),
        max_tokens: flag('max') ? Number(flag('max')) : undefined,
        retrieval_mode: (flag('mode') as RetrievalMode) ?? 'tree',
        include_evidence: process.argv.includes('--evidence'),
        include_packet: process.argv.includes('--packet'),
      });
      console.log(JSON.stringify(bundle, null, 2));
      break;
    }
    case 'write': {
      const result = write({
        content: flag('content') ?? '',
        memory_type: flag('type') as never,
        confidence: flag('confidence') ? Number(flag('confidence')) : undefined,
        tags: flag('tags')?.split(','),
        project_id: flag('project'),
      });
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case 'map':
      console.log(JSON.stringify(memoryMap(flag('project') ?? 'project_memrails'), null, 2));
      break;
    case 'inspect': {
      const bundle = findRetrieval(flag('retrieval') ?? '');
      console.log(bundle ? JSON.stringify(bundle.retrieval_trace, null, 2) : 'not found');
      break;
    }
    default:
      console.error('usage: memrails <retrieve|write|map|inspect> [flags]');
      process.exit(1);
  }
}

main();
