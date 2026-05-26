import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let workdir: string;
const originalCwd = process.cwd();
const originalDataDir = process.env.DATA_DIR;

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'memrails-runtime-'));
  mkdirSync(join(workdir, 'data'), { recursive: true });
  process.chdir(workdir);
  delete process.env.DATA_DIR;
  vi.resetModules();
});

afterEach(() => {
  process.chdir(originalCwd);
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
  if (existsSync(workdir)) rmSync(workdir, { recursive: true, force: true });
});

async function freshRuntime() {
  return (await import('@/lib/runtime')) as typeof import('@/lib/runtime');
}

describe('dataRoot()', () => {
  it('defaults to <cwd>/data when DATA_DIR is unset', async () => {
    const { dataRoot } = await freshRuntime();
    expect(dataRoot()).toBe(join(workdir, 'data'));
  });

  it('honors DATA_DIR when set', async () => {
    const override = mkdtempSync(join(tmpdir(), 'memrails-vol-'));
    process.env.DATA_DIR = override;
    const { dataRoot } = await freshRuntime();
    expect(dataRoot()).toBe(override);
    rmSync(override, { recursive: true, force: true });
  });

  it('resolves the DATA_DIR path absolutely', async () => {
    process.env.DATA_DIR = '/tmp/foo';
    const { dataRoot } = await freshRuntime();
    expect(dataRoot()).toBe('/tmp/foo');
  });
});

describe('store paths follow dataRoot()', () => {
  it('sessions and endpoints write under the override directory', async () => {
    const override = mkdtempSync(join(tmpdir(), 'memrails-stores-'));
    process.env.DATA_DIR = override;
    mkdirSync(join(override, 'logs'), { recursive: true });

    const { authorizeSession } = await import('@/lib/payments/sessions');
    const { deployEndpoint } = await import('@/lib/endpoints/deploy');

    // Need a knowledge corpus for deployEndpoint — seed one in the workdir.
    mkdirSync(join(workdir, 'knowledge', 'claims'), { recursive: true });
    const fs = await import('node:fs');
    fs.writeFileSync(
      join(workdir, 'knowledge', 'claims', 'seed.md'),
      `---\nid: clm_seed\ntags: []\nclaim: seed\n---\n# seed\nseed\n`,
      'utf8',
    );

    const session = authorizeSession({ budget_cents: 100, rail: 'stripe_card' });
    expect(existsSync(join(override, 'sessions', `${session.session_id}.json`))).toBe(true);

    const endpoint = await deployEndpoint();
    expect(existsSync(join(override, 'endpoints', `${endpoint.endpoint_id}.json`))).toBe(true);
    expect(existsSync(join(override, 'logs', 'ledger.jsonl'))).toBe(true);

    expect(existsSync(join(workdir, 'data', 'sessions'))).toBe(false);
    expect(existsSync(join(workdir, 'data', 'endpoints'))).toBe(false);

    rmSync(override, { recursive: true, force: true });
  });
});
