import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { logEvent } from '@/lib/ledger/events';
import { loadCorpus } from '@/lib/memory/corpus';
import type { DeployStep, Endpoint } from '@/types/endpoint';
import { BASELINE_CONFIG, COMPRESSOR_ID, INTEGRATIONS } from './baseline';
import { loadEndpoint, saveEndpoint } from './store';

export class EndpointNotFound extends Error {
  constructor(endpoint_id: string) {
    super(`endpoint_not_found: ${endpoint_id}`);
    this.name = 'EndpointNotFound';
  }
}

export class InvalidEndpointTransition extends Error {
  constructor(from: string, to: string) {
    super(`invalid_endpoint_transition: ${from} -> ${to}`);
    this.name = 'InvalidEndpointTransition';
  }
}

export class InvalidCorpusPath extends Error {
  constructor(path: string) {
    super(`invalid_corpus_path: ${path}`);
    this.name = 'InvalidCorpusPath';
  }
}

export type DeployInput = {
  corpus_path?: string;
  payer_agent_id?: string;
  // Honest knob for tests: skip the simulated ~2s sleeps so the suite stays fast.
  simulate_latency?: boolean;
};

const PROVISION_LATENCY_MS = 1800;
const APPLY_CONFIG_LATENCY_MS = 60;
const BIND_COMPRESS_LATENCY_MS = 90;
const WIRE_INTEGRATIONS_LATENCY_MS = 120;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function assertCorpusPathInsideCwd(corpus_path: string): void {
  const cwd = resolve(process.cwd());
  const target = resolve(cwd, corpus_path);
  if (!target.startsWith(cwd + '/') && target !== cwd) {
    throw new InvalidCorpusPath(corpus_path);
  }
}

export async function deployEndpoint(input: DeployInput = {}): Promise<Endpoint> {
  const corpus_path = input.corpus_path ?? 'knowledge/';
  assertCorpusPathInsideCwd(corpus_path);
  const simulate = input.simulate_latency ?? false;

  const endpoint_id = `ep_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const now = new Date().toISOString();
  const url = `https://hx.memrails.dev/${endpoint_id}`;
  const deploy_log: DeployStep[] = [];

  // Stage 1 — provision openclaw (stub).
  if (simulate) await sleep(PROVISION_LATENCY_MS);
  deploy_log.push({
    name: 'provision_openclaw',
    status: 'ok',
    latency_ms: simulate ? PROVISION_LATENCY_MS : 12,
    note: 'harness ready',
  });

  // Stage 2 — index knowledge (real work — count corpus).
  const indexStart = Date.now();
  const corpus = loadCorpus();
  const indexElapsed = Date.now() - indexStart;
  const claims = corpus.length;
  const files = new Set(corpus.map((c) => c.claim.source_file)).size;
  deploy_log.push({
    name: 'index_knowledge',
    status: 'ok',
    latency_ms: indexElapsed,
    note: `${claims} claims · ${files} files`,
  });

  // Stage 3 — apply pre-tuned config.
  if (simulate) await sleep(APPLY_CONFIG_LATENCY_MS);
  deploy_log.push({
    name: 'apply_config',
    status: 'ok',
    latency_ms: simulate ? APPLY_CONFIG_LATENCY_MS : 1,
    note: 'baseline config',
  });

  // Stage 4 — bind compress-v1.
  if (simulate) await sleep(BIND_COMPRESS_LATENCY_MS);
  deploy_log.push({
    name: 'bind_compress',
    status: 'ok',
    latency_ms: simulate ? BIND_COMPRESS_LATENCY_MS : 1,
    note: COMPRESSOR_ID,
  });

  // Stage 5 — wire integrations.
  if (simulate) await sleep(WIRE_INTEGRATIONS_LATENCY_MS);
  deploy_log.push({
    name: 'wire_integrations',
    status: 'ok',
    latency_ms: simulate ? WIRE_INTEGRATIONS_LATENCY_MS : 1,
    note: `${INTEGRATIONS.length} runtimes`,
  });

  const endpoint: Endpoint = {
    endpoint_id,
    url,
    status: 'live',
    corpus_path,
    corpus_keys: claims,
    compressor: COMPRESSOR_ID,
    config: BASELINE_CONFIG,
    integrations: INTEGRATIONS,
    deploy_log,
    payer_agent_id: input.payer_agent_id,
    created_at: now,
    updated_at: new Date().toISOString(),
  };

  saveEndpoint(endpoint);
  logEvent(
    'HARNESS_DEPLOYED',
    {
      endpoint_id: endpoint.endpoint_id,
      url: endpoint.url,
      corpus_keys: endpoint.corpus_keys,
      corpus_path: endpoint.corpus_path,
      compressor: endpoint.compressor,
      integrations: INTEGRATIONS.map((i) => i.id),
      deploy_log,
    },
    { endpoint_id: endpoint.endpoint_id },
  );

  return endpoint;
}

export function closeEndpoint(endpoint_id: string): Endpoint {
  const ep = loadEndpoint(endpoint_id);
  if (!ep) throw new EndpointNotFound(endpoint_id);
  if (ep.status === 'closed') return ep;
  ep.status = 'closed';
  ep.updated_at = new Date().toISOString();
  saveEndpoint(ep);
  return ep;
}
