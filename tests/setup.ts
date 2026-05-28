import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll } from 'vitest';

// Route the JSONL ledger to a throwaway temp file so exercising the
// `memory.query()` orchestrator in tests never pollutes the real
// `data/logs/ledger.jsonl` (§5 console must stay reconcilable).
beforeAll(() => {
  const dir = mkdtempSync(join(tmpdir(), 'memrails-ledger-'));
  process.env.MEMRAILS_LEDGER_PATH = join(dir, 'ledger.jsonl');
});
