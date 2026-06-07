import { clusterIntents, loadObservations } from '../src/lib/demand/aggregate';
import { rank, score } from '../src/lib/demand/popularity';
import { parseWindow } from '../src/lib/demand/window';
import { genuinenessFor } from '../src/lib/demand/genuineness';
import { listStakes } from '../src/lib/demand/stake';

function parseArgs(argv: string[]): { since?: string; top: number; genuineness: boolean } {
  let since: string | undefined;
  let top = 50;
  let genuineness = true;
  for (const a of argv) {
    if (a.startsWith('--since=')) since = a.slice('--since='.length);
    else if (a.startsWith('--top=')) {
      const n = Number(a.slice('--top='.length));
      if (Number.isFinite(n) && n > 0) top = Math.min(500, Math.floor(n));
    } else if (a === '--no-genuineness') {
      genuineness = false;
    }
  }
  return { since, top, genuineness };
}

function main() {
  const { since, top, genuineness } = parseArgs(process.argv.slice(2));
  const window = parseWindow(since);
  const observations = loadObservations({
    since: new Date(window.since),
    until: new Date(window.until),
  });
  const clusters = clusterIntents(observations);
  const stakes = listStakes();
  const scores = rank(
    clusters.map((c) => {
      const g = genuineness ? genuinenessFor(c, observations, stakes) : 1.0;
      return score(c, observations, { window, genuineness: g });
    }),
  ).slice(0, top);

  const totalActors = new Set(observations.map((o) => o.actor_id)).size;
  const activeStakes = stakes.filter((s) => s.status === 'active').length;
  process.stdout.write(
    `\nMemRails Intent Index — window ${window.since} → ${window.until}\n`,
  );
  process.stdout.write(
    `${observations.length} observations · ${clusters.length} clusters · ${totalActors} distinct actors · ${activeStakes} active stakes${genuineness ? '' : ' · genuineness OFF'}\n\n`,
  );

  if (scores.length === 0) {
    process.stdout.write('  (no observations in window — issue a query first)\n\n');
    return;
  }

  process.stdout.write('  RANK  COMPOSITE   FREQ      VEL   BR    GEN   OBS  CANONICAL\n');
  let i = 1;
  for (const s of scores) {
    process.stdout.write(
      `  ${pad(i, 4)}  ${pad(s.composite.toFixed(4), 9)}  ${pad(s.frequency.toFixed(4), 7)}  ${pad(s.velocity.toFixed(0), 4)}  ${pad(s.breadth.toFixed(1), 4)}  ${pad(s.genuineness.toFixed(2), 5)}  ${pad(s.observations, 4)}  ${s.canonical_text.slice(0, 60)}\n`,
    );
    i += 1;
  }
  process.stdout.write('\n');
}

function pad(s: string | number, n: number): string {
  return String(s).padStart(n);
}

main();
