import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { loadCorpus } from '../src/lib/memory/corpus';

function main() {
  const corpus = loadCorpus({ force: true });
  const out = resolve(process.cwd(), 'data', 'generated', 'index.json');
  if (!existsSync(dirname(out))) mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        count: corpus.length,
        claims: corpus.map((e) => e.claim),
      },
      null,
      2,
    ),
  );
  console.log(`indexed ${corpus.length} claim(s) → ${out}`);
}

main();
