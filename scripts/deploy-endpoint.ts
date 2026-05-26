import { deployEndpoint } from '../src/lib/endpoints/deploy';
import type { DeployStep } from '../src/types/endpoint';

const STEP_LABELS: Record<DeployStep['name'], string> = {
  provision_openclaw: 'provision openclaw    ',
  index_knowledge: 'index knowledge/      ',
  apply_config: 'apply pre-tuned config',
  bind_compress: 'bind compress-v1      ',
  wire_integrations: 'wire integrations     ',
};

function renderLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

async function main() {
  const argv = process.argv.slice(2);
  let corpus_path = 'knowledge/';
  let simulate_latency = true;
  let managed = false;

  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === '--managed') {
      managed = true;
    } else if (t === '--corpus-path' && i + 1 < argv.length) {
      corpus_path = argv[i + 1];
      i += 1;
    } else if (t === '--no-simulate') {
      simulate_latency = false;
    }
  }

  if (!managed) {
    console.error('usage: npm run memrails:deploy -- --managed [--corpus-path <path>] [--no-simulate]');
    process.exit(1);
  }

  console.log('$ memrails harness deploy --managed');
  const start = Date.now();
  const ep = await deployEndpoint({ corpus_path, simulate_latency });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  let anyFailed = false;
  for (const step of ep.deploy_log) {
    const label = STEP_LABELS[step.name];
    const status = step.status === 'ok' ? 'ok    ' : 'failed';
    const lat = renderLatency(step.latency_ms);
    const note = step.note ? `  ${step.note}` : '';
    console.log(`  ◎ ${label}  ${status} ${lat}${note}`);
    if (step.status === 'failed') anyFailed = true;
  }
  console.log('');
  console.log(`  ◊ endpoint  ${ep.url}`);
  console.log(
    `  ◊ status    ${ep.status}${ep.status === 'live' ? ' · querying enabled' : ''}`,
  );
  console.log('');
  console.log(`  deploy · ${elapsed}s total`);

  if (anyFailed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
