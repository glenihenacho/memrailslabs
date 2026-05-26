import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Endpoint } from '@/types/endpoint';
import { dataRoot } from '@/lib/runtime';

const ENDPOINT_ID_PATTERN = /^ep_[a-z0-9]{6,32}$/;

export function endpointsDir(): string {
  return resolve(dataRoot(), 'endpoints');
}

function ensureDir(): void {
  const dir = endpointsDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function saveEndpoint(endpoint: Endpoint): void {
  ensureDir();
  const path = resolve(endpointsDir(), `${endpoint.endpoint_id}.json`);
  writeFileSync(path, `${JSON.stringify(endpoint, null, 2)}\n`, 'utf8');
}

export function loadEndpoint(endpoint_id: string): Endpoint | null {
  if (!ENDPOINT_ID_PATTERN.test(endpoint_id)) return null;
  const path = resolve(endpointsDir(), `${endpoint_id}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Endpoint;
  } catch {
    return null;
  }
}

export function listEndpoints(): Endpoint[] {
  const dir = endpointsDir();
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  const out: Endpoint[] = [];
  for (const f of files) {
    try {
      const raw = readFileSync(resolve(dir, f), 'utf8');
      out.push(JSON.parse(raw) as Endpoint);
    } catch {
      // skip malformed
    }
  }
  out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return out;
}
