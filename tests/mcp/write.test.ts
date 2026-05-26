import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let workdir: string;
const originalCwd = process.cwd();

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'memrails-mcp-write-'));
  mkdirSync(join(workdir, 'knowledge', 'claims'), { recursive: true });
  mkdirSync(join(workdir, 'data', 'logs'), { recursive: true });
  mkdirSync(join(workdir, 'data', 'refactors'), { recursive: true });
  writeFileSync(
    join(workdir, 'knowledge', 'claims', 'seed.md'),
    `---\nid: clm_seed\ntags: []\nclaim: seed\n---\n# seed\nseed body\n`,
    'utf8',
  );
  process.chdir(workdir);
  vi.resetModules();
});

afterEach(() => {
  process.chdir(originalCwd);
  if (existsSync(workdir)) rmSync(workdir, { recursive: true, force: true });
});

async function freshTools() {
  return (await import('@/lib/mcp/tools')) as typeof import('@/lib/mcp/tools');
}

describe('memory.write MCP handler', () => {
  it('returns a refactor_id and proposed status on the happy path', async () => {
    const { handleWrite } = await freshTools();
    const result = await handleWrite({
      claim: 'A claim proposed via MCP',
      evidence: ['https://example.com/source'],
    });
    expect(result.isError).toBeFalsy();
    const body = JSON.parse(result.content[0].text) as {
      refactor_id: string;
      status: string;
      type: string;
      validator: { ok: boolean };
    };
    expect(body.refactor_id).toMatch(/^ref_[a-z0-9]{6,32}$/);
    expect(body.status).toBe('proposed');
    expect(body.type).toBe('ADD_CLAIM');
    expect(body.validator.ok).toBe(true);
  });

  it('records validator issues but still returns a proposal', async () => {
    const { handleWrite } = await freshTools();
    const result = await handleWrite({ claim: 'unbacked' });
    expect(result.isError).toBeFalsy();
    const body = JSON.parse(result.content[0].text) as {
      validator: { ok: boolean; issues: string[] };
    };
    expect(body.validator.ok).toBe(false);
    expect(body.validator.issues).toContain('missing_evidence_and_stake');
  });

  it('returns isError when target_file escapes the knowledge directory', async () => {
    const { handleWrite } = await freshTools();
    const result = await handleWrite({
      claim: 'bad target',
      evidence: ['e'],
      target_file: '../etc/passwd',
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/target_file_outside_knowledge/);
  });
});
