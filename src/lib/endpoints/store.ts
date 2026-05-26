import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Endpoint } from '@/types/endpoint';

const ENDPOINTS_DIR = resolve(process.cwd(), 'data', 'endpoints');
const ENDPOINT_ID_PATTERN = /^ep_[a-z0-9]{6,32}$/;

function ensureDir(): void {
  if (!existsSync(ENDPOINTS_DIR)) {
    mkdirSync(ENDPOINTS_DIR, { recursive: true });
  }
}

export function saveEndpoint(endpoint: Endpoint): void {
  ensureDir();
  const path = resolve(ENDPOINTS_DIR, `${endpoint.endpoint_id}.json`);
  writeFileSync(path, `${JSON.stringify(endpoint, null, 2)}\n`, 'utf8');
}

export function loadEndpoint(endpoint_id: string): Endpoint | null {
  if (!ENDPOINT_ID_PATTERN.test(endpoint_id)) return null;
  const path = resolve(ENDPOINTS_DIR, `${endpoint_id}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Endpoint;
  } catch {
    return null;
  }
}

export function listEndpoints(): Endpoint[] {
  if (!existsSync(ENDPOINTS_DIR)) return [];
  const files = readdirSync(ENDPOINTS_DIR).filter((f) => f.endsWith('.json'));
  const out: Endpoint[] = [];
  for (const f of files) {
    try {
      const raw = readFileSync(resolve(ENDPOINTS_DIR, f), 'utf8');
      out.push(JSON.parse(raw) as Endpoint);
    } catch {
      // skip malformed
    }
  }
  out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return out;
}

export function endpointsDir(): string {
  return ENDPOINTS_DIR;
}
