import { readAllEvents } from '../src/lib/ledger/jsonl';

async function main() {
  const argv = process.argv.slice(2);
  const id = argv[0];
  if (!id) {
    console.error('usage: npm run memory:inspect -- "<packet_id>"');
    process.exit(1);
  }
  const events = readAllEvents();
  const created = events.find(
    (e) => e.event_type === 'PACKET_CREATED' && e.packet_id === id,
  );
  if (!created) {
    console.error(`packet not found in ledger: ${id}`);
    process.exit(2);
  }
  console.log(JSON.stringify(created, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
