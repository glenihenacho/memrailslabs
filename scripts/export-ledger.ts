/**
 * Export the ledger as JSONL — one event per line, oldest first.
 *
 * C3: JSONL is the *export format* of the ledger. In file mode this streams
 * the live `data/logs/ledger.jsonl`; in postgres mode it reads the
 * `ledger_events` table in `seq` order — same lines, same format, no lock-in
 * either way (CLAUDE.md Rule 7).
 */
import { readLedger } from '../src/lib/ledger/events';
import { authorityMode, closeDb } from '../src/lib/memory/authority';

async function main() {
  const events = await readLedger();
  process.stderr.write(`exporting ${events.length} event(s) from the ${authorityMode()} ledger\n`);
  for (const e of events) {
    process.stdout.write(`${JSON.stringify(e)}\n`);
  }
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
