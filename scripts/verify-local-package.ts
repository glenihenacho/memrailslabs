/**
 * @memrails/local package verification (C7.1).
 *
 * Builds the package, then exercises the *built artifact* — not the repo
 * sources — from a clean temp working directory with its own data dir and no
 * knowledge corpus: write → retrieve (planner-named trace) → supersede with
 * explained omission → export → wipe → import → identical retrieve. The
 * embedded runtime proves the contract loop end-to-end, self-contained.
 *
 *   npm run package:verify
 */
import { execSync, spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(__dirname, '..');

console.log('▸ building @memrails/local …');
execSync('npx tsup --config packages/local/tsup.config.ts', { cwd: root, stdio: 'inherit' });

const work = mkdtempSync(join(tmpdir(), 'memrails-local-smoke-'));
const distEsm = join(root, 'packages', 'local', 'dist', 'index.js');

const smoke = `
import { pathToFileURL } from 'node:url';
const m = await import(pathToFileURL(${JSON.stringify(distEsm)}).href);

const fail = (msg) => { console.error('SMOKE FAIL: ' + msg); process.exit(1); };

// 1. Governed write + core retrieve, in an empty runtime.
const a = m.write({ content: 'Local package smoke: the embedded runtime answers.', tags: ['smoke'], confidence: 0.9 });
const b = m.write({ content: 'Local package smoke: an older fact to supersede.', tags: ['smoke'], confidence: 0.8 });
const bundle = m.retrieve({ task_context: 'local package smoke embedded runtime' });
if (!bundle.memories.some((x) => x.memory_id === a.memory_id)) fail('retrieve missed the written memory');
if (!bundle.retrieval_trace.planner) fail('trace does not name its planner (§9 v0.1.1)');
if (bundle.usage.billable_retrievals !== 0) fail('self-hosted runtime must be unmetered by default (§5.8)');

// 2. Governance: supersede leaves retrieval and is explained (§4.3).
m.supersede(b.memory_id, { new_memory: { content: 'Local package smoke: the corrected fact.', tags: ['smoke'], confidence: 0.9 } });
const after = m.retrieve({ task_context: 'local package smoke older fact supersede corrected' });
if (after.memories.some((x) => x.memory_id === b.memory_id)) fail('superseded memory still retrieved');
if (!after.omitted.some((o) => o.memory_id === b.memory_id && o.reason)) fail('superseded omission unexplained');

// 3. Portability round-trip in-process (§6): export → wipe → import.
const { jsonl } = m.exportRecords();
const fingerprint = (x) => x.memories.map((mm) => mm.memory_id + '|' + mm.summary + '|' + mm.confidence).join(';');
const beforeFp = fingerprint(m.retrieve({ task_context: 'local package smoke embedded runtime' }));
const report = m.importRecords(jsonl);
if (report.errors > 0) fail('import errors: ' + report.errors);
const afterFp = fingerprint(m.retrieve({ task_context: 'local package smoke embedded runtime' }));
if (beforeFp !== afterFp) fail('round-trip changed retrieve results');

// 4. Projection (§7) renders from the governed store.
const proj = m.projectMarkdown();
if (!proj.markdown.includes('DERIVED ARTIFACT')) fail('projection missing DERIVED ARTIFACT header');

await m.flushAuthority();
await m.closeDb();
console.log(JSON.stringify({ ok: true, memories: bundle.memories.length, planner: bundle.retrieval_trace.planner }));
`;

let res: SpawnSyncReturns<string>;
try {
  writeFileSync(join(work, 'smoke.mjs'), smoke, 'utf8');

  console.log(`▸ running smoke against the built artifact (cwd: ${work}) …`);
  res = spawnSync(process.execPath, ['smoke.mjs'], {
    cwd: work,
    env: {
      ...process.env,
      MEMRAILS_DATA_DIR: join(work, 'data'),
      MEMRAILS_KNOWLEDGE_DIR: join(work, 'knowledge'), // does not exist → empty corpus
      MEMRAILS_AUTHORITY: 'file',
    },
    encoding: 'utf8',
  });

  process.stdout.write(res.stdout ?? '');
  process.stderr.write(res.stderr ?? '');
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (res.status !== 0) {
  console.error('✗ @memrails/local package verification FAILED');
  process.exit(1);
}
console.log('✓ @memrails/local package verified: build + embedded contract loop green');
