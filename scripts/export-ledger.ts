import { readAllEvents, ledgerPath } from '../src/lib/ledger/jsonl';

function main() {
  const events = readAllEvents();
  process.stderr.write(
    `exporting ${events.length} event(s) from ${ledgerPath()}\n`,
  );
  for (const e of events) {
    process.stdout.write(`${JSON.stringify(e)}\n`);
  }
}

main();
