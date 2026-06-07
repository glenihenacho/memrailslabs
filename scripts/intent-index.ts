import { clusterIntents, loadObservations } from '../src/lib/demand/aggregate';
import { rank, score } from '../src/lib/demand/popularity';
import { parseWindow } from '../src/lib/demand/window';

function parseArgs(argv: string[]): { since?: string; top: number } {
  let since: string | undefined;
  let top = 50;
  for (const a of argv) {
    if (a.startsWith('--since=')) since = a.slice('--since='.length);
    else if (a.startsWith('--top=')) {
      const n = Number(a.slice('--top='.length));
      if (Number.isFinite(n) && n > 0) top = Math.min(500, Math.floor(n));
    }
  }
  return { since, top };
}

function main() {
  const { since, top } = parseArgs(process.argv.slice(2));
  const window = parseWindow(since);
  const observations = loadObservations({
    since: new Date(window.since),
    until: new Date(window.until),
  });
  const clusters = clusterIntents(observations);
  const scores = rank(clusters.map((c) => score(c, observations, { window }))).slice(0, top);

  const totalActors = new Set(observations.map((o) => o.actor_id)).size;
  process.stdout.write(
    `\nMemRails Intent Index — window ${window.since} → ${window.until}\n`,
  );
  process.stdout.write(
    `${observations.length} observations · ${clusters.length} clusters · ${totalActors} distinct actors\n\n`,
  );

  if (scores.length === 0) {
    process.stdout.write('  (no observations in window — issue a query first)\n\n');
    return;
  }

  process.stdout.write('  RANK  COMPOSITE   FREQ      VEL   BR   OBS  CANONICAL\n');
  let i = 1;
  for (const s of scores) {
    process.stdout.write(
      `  ${pad(i, 4)}  ${pad(s.composite.toFixed(4), 9)}  ${pad(s.frequency.toFixed(4), 7)}  ${pad(s.velocity.toFixed(0), 4)}  ${pad(s.breadth.toFixed(1), 4)}  ${pad(s.observations, 4)}  ${s.canonical_text.slice(0, 60)}\n`,
    );
    i += 1;
  }
  process.stdout.write('\n');
}

function pad(s: string | number, n: number): string {
  return String(s).padStart(n);
}

main();
