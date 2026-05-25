import { loadPacket } from '../src/lib/memory/store';

async function main() {
  const argv = process.argv.slice(2);
  const id = argv[0];
  if (!id) {
    console.error('usage: npm run memory:inspect -- "<packet_id>"');
    process.exit(1);
  }
  const packet = loadPacket(id);
  if (!packet) {
    console.error(`packet not found in store: ${id}`);
    process.exit(2);
  }
  console.log(JSON.stringify(packet, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
