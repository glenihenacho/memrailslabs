import { query } from '../src/lib/memory';

async function main() {
  const argv = process.argv.slice(2);
  const q = argv.join(' ').trim();
  if (!q) {
    console.error('usage: npm run memory:query -- "<question>"');
    process.exit(1);
  }
  const packet = await query({ query: q, intent: 'answer' });
  console.log(JSON.stringify(packet, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
