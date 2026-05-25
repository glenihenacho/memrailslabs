import { query } from '../src/lib/memory';
import type { PacketIntent } from '../src/types/packet';

const INTENTS: PacketIntent[] = ['answer', 'summarize', 'compare', 'extract', 'refactor', 'route'];

async function main() {
  const argv = process.argv.slice(2);
  let intent: PacketIntent = 'answer';
  const rest: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--intent' && i + 1 < argv.length) {
      const next = argv[i + 1] as PacketIntent;
      if (INTENTS.includes(next)) {
        intent = next;
        i += 1;
        continue;
      }
    }
    rest.push(token);
  }

  const q = rest.join(' ').trim();
  if (!q) {
    console.error('usage: npm run memory:query -- [--intent <intent>] "<question>"');
    process.exit(1);
  }
  const packet = await query({ query: q, intent });
  console.log(JSON.stringify(packet, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
