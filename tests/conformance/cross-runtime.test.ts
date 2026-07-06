/**
 * Cross-runtime portability — the §10 **Portable** certification (C7.2).
 *
 * The §6 round-trip law, across two *genuinely different runtimes*: every
 * runtime here is a separate OS process (the reference CLI) with its own data
 * directory and its own authority backend. Both directions:
 *
 *   file runtime  → export → import → postgres runtime   (identical retrieves)
 *   postgres runtime → export → import → file runtime    (identical retrieves)
 *
 * Fingerprints compare everything a caller can receive that must survive the
 * trip (§6): memory identity, summary, confidence, status, index path, and
 * explained omissions — not process-local ids, latencies, or usage.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { ContextBundle } from '@/types/bundle';

const ROOT = resolve(__dirname, '../..');
const TSX = join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const CLI = join(ROOT, 'scripts', 'memrails.ts');

type Runtime = {
  name: string;
  env: Record<string, string>;
};

function cli(rt: Runtime, args: string[]): string {
  // Each runtime gets a clean slate: the outer test process's planner and
  // authority selection must not leak into the subprocess.
  const env: NodeJS.ProcessEnv = { ...process.env, ...rt.env };
  delete env.MEMRAILS_PLANNER;
  const res = spawnSync(process.execPath, [TSX, CLI, ...args], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    timeout: 120_000,
  });
  if (res.status !== 0) {
    throw new Error(`[${rt.name}] memrails ${args[0]} failed (${res.status}):\n${res.stderr}`);
  }
  return res.stdout;
}

/** What §6 says must survive: identity + governed state + explained omissions. */
function fingerprint(bundleJson: string): string {
  const bundle = JSON.parse(bundleJson) as ContextBundle;
  const memories = bundle.memories
    .map((m) => `${m.memory_id}|${m.summary}|${m.confidence}|${m.status}|${m.index_path}`)
    .sort();
  const omitted = bundle.omitted.map((o) => o.memory_id).sort();
  return JSON.stringify({ memories, omitted });
}

const QUERIES = [
  'cross runtime portable subject memory',
  'cross runtime expired window fact',
];

function retrieveFingerprints(rt: Runtime): string[] {
  return QUERIES.map((q) => fingerprint(cli(rt, ['retrieve', '--context', q, '--max', '1800'])));
}

describe('§10 Portable — round-trip across two runtimes (separate processes, different backends)', () => {
  it(
    'file → postgres and postgres → file reproduce identical retrieves',
    () => {
      const work = mkdtempSync(join(tmpdir(), 'memrails-xrt-'));
      const emptyKnowledge = join(work, 'knowledge'); // never created → empty corpus in every runtime
      try {
        const fileA: Runtime = {
          name: 'file-A',
          env: {
            MEMRAILS_AUTHORITY: 'file',
            MEMRAILS_DATA_DIR: join(work, 'a-data'),
            MEMRAILS_KNOWLEDGE_DIR: emptyKnowledge,
          },
        };
        const pgB: Runtime = {
          name: 'pg-B',
          env: {
            MEMRAILS_AUTHORITY: 'postgres',
            MEMRAILS_DATA_DIR: join(work, 'b-data'),
            MEMRAILS_PG_DIR: join(work, 'b-pg'),
            MEMRAILS_KNOWLEDGE_DIR: emptyKnowledge,
          },
        };
        const fileC: Runtime = {
          name: 'file-C',
          env: {
            MEMRAILS_AUTHORITY: 'file',
            MEMRAILS_DATA_DIR: join(work, 'c-data'),
            MEMRAILS_KNOWLEDGE_DIR: emptyKnowledge,
          },
        };
        mkdirSync(join(work, 'a-data'), { recursive: true });

        // ── Seed runtime A (file): writes + a governed transition, all via CLI.
        cli(fileA, ['write', '--content', 'Cross runtime portable subject memory: the fact that travels.', '--tags', 'xrt', '--confidence', '0.9']);
        cli(fileA, ['write', '--content', 'Cross runtime second memory: companion fact for ranking.', '--tags', 'xrt', '--confidence', '0.85']);
        cli(fileA, [
          'write',
          '--content', 'Cross runtime expired window fact: was only valid last week.',
          '--tags', 'xrt',
          '--confidence', '0.9',
          '--expires', new Date(Date.now() - 86_400_000).toISOString(),
        ]);
        // Staleness re-verification: an evented, versioned confidence downgrade
        // (§4.6) — governed state that MUST survive the trip.
        cli(fileA, ['staleness']);

        const before = retrieveFingerprints(fileA);
        const exportPath = join(work, 'a-export.jsonl');
        cli(fileA, ['export', '--out', exportPath]);

        // ── Direction 1: import into a separate Postgres-canonical process.
        const importReport = JSON.parse(cli(pgB, ['import', '--in', exportPath])) as { imported: number; errors: number };
        expect(importReport.errors).toBe(0);
        expect(importReport.imported).toBeGreaterThanOrEqual(3);
        expect(retrieveFingerprints(pgB)).toEqual(before);

        // ── Direction 2: grow the Postgres store, export, import into a fresh
        //    file-canonical process.
        cli(pgB, ['write', '--content', 'Cross runtime portable subject memory: born in the postgres runtime.', '--tags', 'xrt', '--confidence', '0.88']);
        const grown = retrieveFingerprints(pgB);
        expect(grown).not.toEqual(before); // the new memory is visible…
        const exportPathB = join(work, 'b-export.jsonl');
        cli(pgB, ['export', '--out', exportPathB]);

        const importReportC = JSON.parse(cli(fileC, ['import', '--in', exportPathB])) as { errors: number };
        expect(importReportC.errors).toBe(0);
        expect(retrieveFingerprints(fileC)).toEqual(grown); // …and identical after the reverse trip.
      } finally {
        rmSync(work, { recursive: true, force: true });
      }
    },
    { timeout: 300_000 },
  );
});
