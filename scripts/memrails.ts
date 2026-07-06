#!/usr/bin/env tsx
/**
 * MemRails CLI — in-process governed memory for local agents.
 *
 *   npm run memrails -- retrieve --project project_memrails --context "build the roadmap"
 *   npm run memrails -- write --content "..." --type decision --confidence 0.95
 *   npm run memrails -- map --project project_memrails
 *   npm run memrails -- inspect --retrieval ret_xxx
 *   npm run memrails -- project-md --out memrails.md
 *   npm run memrails -- export --out records.jsonl [--include-sensitive]
 *   npm run memrails -- import --in records.jsonl
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { retrieve } from '@/lib/memory/retrieve';
import { write } from '@/lib/memory/write';
import { findRetrieval } from '@/lib/memory/telemetry';
import { memoryMap } from '@/lib/memory';
import { projectMarkdown } from '@/lib/memory/project-md';
import { exportRecords, importRecords } from '@/lib/memory/records';
import { reverifyStaleness } from '@/lib/memory/staleness';
import type { RetrievalMode } from '@/types/bundle';
import { ensureAuthorityReady, flushAuthority, closeDb } from '@/lib/memory/authority';
// Side-effect import: installs the billing meter so CLI retrievals stay billed.
import '@/lib/billing/meter';

function flag(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main() {
  // Hydrate the Postgres authority (no-op in file mode) before sync reads;
  // flush pending persistence before the process exits.
  await ensureAuthorityReady();
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
        expires_at: flag('expires'),
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
    case 'project-md': {
      const { markdown, stats } = projectMarkdown({
        owner_id: flag('owner'),
        project_id: flag('project'),
        agent_id: flag('agent') ?? null,
        include_sensitive: process.argv.includes('--include-sensitive'),
      });
      const out = flag('out') ?? 'memrails.md';
      writeFileSync(out, `${markdown.trimEnd()}\n`, 'utf8');
      console.log(JSON.stringify({ out, ...stats }, null, 2));
      break;
    }
    case 'export': {
      const { jsonl, stats } = exportRecords({
        owner_id: flag('owner'),
        project_id: flag('project'),
        include_sensitive: process.argv.includes('--include-sensitive'),
      });
      const out = flag('out');
      if (out) {
        writeFileSync(out, jsonl, 'utf8');
        console.log(JSON.stringify({ out, ...stats }, null, 2));
      } else {
        process.stdout.write(jsonl);
      }
      break;
    }
    case 'staleness': {
      const report = reverifyStaleness({ dry_run: process.argv.includes('--dry-run') });
      console.log(JSON.stringify(report, null, 2));
      break;
    }
    case 'import': {
      const src = flag('in');
      if (!src) {
        console.error('usage: memrails import --in <records.jsonl>');
        process.exit(1);
      }
      const report = importRecords(readFileSync(src, 'utf8'));
      console.log(JSON.stringify(report, null, 2));
      break;
    }
    default:
      console.error('usage: memrails <retrieve|write|map|inspect|project-md|export|import|staleness> [flags]');
      process.exit(1);
  }
}

main()
  .then(() => flushAuthority())
  .then(() => closeDb()) // release the PGlite handle so the process can exit
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
