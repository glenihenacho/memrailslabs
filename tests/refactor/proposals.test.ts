import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let workdir: string;
const originalCwd = process.cwd();

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'memrails-refactor-'));
  mkdirSync(join(workdir, 'knowledge', 'claims'), { recursive: true });
  mkdirSync(join(workdir, 'data', 'logs'), { recursive: true });
  mkdirSync(join(workdir, 'data', 'refactors'), { recursive: true });
  // Seed corpus so findClaim is wired and collision checks are exercised.
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

async function freshProposals() {
  return (await import('@/lib/refactor/proposals')) as typeof import('@/lib/refactor/proposals');
}

describe('proposeRefactor', () => {
  it('creates an ADD_CLAIM proposal and persists it', async () => {
    const { proposeRefactor } = await freshProposals();
    const prop = proposeRefactor({
      claim: 'Compress-v1 is the MemRails synthesis model',
      evidence: ['https://example.com/compress-v1'],
    });
    expect(prop.refactor_id).toMatch(/^ref_[a-z0-9]{6,32}$/);
    expect(prop.status).toBe('proposed');
    expect(prop.type).toBe('ADD_CLAIM');
    expect(prop.target_file).toMatch(/^knowledge\/claims\/.*\.md$/);
    expect(prop.proposed_diff).toContain('--- /dev/null');
    expect(prop.validator.ok).toBe(true);
    expect(existsSync(join(workdir, 'data', 'refactors', `${prop.refactor_id}.json`))).toBe(true);
  });

  it('records validator issues when evidence and stake are missing', async () => {
    const { proposeRefactor } = await freshProposals();
    const prop = proposeRefactor({ claim: 'unbacked' });
    expect(prop.validator.ok).toBe(false);
    expect(prop.validator.issues).toContain('missing_evidence_and_stake');
    expect(prop.status).toBe('proposed');
  });

  it('rejects a target_file outside knowledge/', async () => {
    const { proposeRefactor, ProposalRejected } = await freshProposals();
    expect(() =>
      proposeRefactor({
        claim: 'sneaky',
        evidence: ['ok'],
        target_file: '../etc/passwd',
      }),
    ).toThrow(ProposalRejected);
  });
});

describe('acceptRefactor', () => {
  it('writes the markdown file and marks the proposal accepted', async () => {
    const { proposeRefactor, acceptRefactor } = await freshProposals();
    const prop = proposeRefactor({
      claim: 'A new accepted claim',
      evidence: ['https://example.com/a'],
    });
    const accepted = acceptRefactor(prop.refactor_id);
    expect(accepted.status).toBe('accepted');
    expect(accepted.applied_path).toBe(prop.target_file);
    const written = readFileSync(join(workdir, prop.target_file!), 'utf8');
    expect(written).toContain('id: ' + prop.claim_id);
    expect(written).toContain('A new accepted claim');
  });

  it('is idempotent', async () => {
    const { proposeRefactor, acceptRefactor } = await freshProposals();
    const prop = proposeRefactor({
      claim: 'idempotent',
      evidence: ['x'],
    });
    const first = acceptRefactor(prop.refactor_id);
    const path = join(workdir, prop.target_file!);
    const mtimeOne = statSync(path).mtimeMs;
    // Wait a tick to ensure mtime would differ if the file were rewritten.
    const second = acceptRefactor(prop.refactor_id);
    const mtimeTwo = statSync(path).mtimeMs;
    expect(second.status).toBe('accepted');
    expect(mtimeOne).toBe(mtimeTwo);
    expect(first.refactor_id).toBe(second.refactor_id);
  });

  it('throws InvalidTransition when accepting a rejected proposal', async () => {
    const { proposeRefactor, rejectRefactor, acceptRefactor, InvalidTransition } =
      await freshProposals();
    const prop = proposeRefactor({ claim: 'reject me', evidence: ['e'] });
    rejectRefactor(prop.refactor_id, 'no thanks');
    expect(() => acceptRefactor(prop.refactor_id)).toThrow(InvalidTransition);
  });

  it('throws RefactorNotFound on unknown id', async () => {
    const { acceptRefactor, RefactorNotFound } = await freshProposals();
    expect(() => acceptRefactor('ref_doesnotexist')).toThrow(RefactorNotFound);
  });
});

describe('rejectRefactor', () => {
  it('marks rejected without writing the file', async () => {
    const { proposeRefactor, rejectRefactor } = await freshProposals();
    const prop = proposeRefactor({ claim: 'will reject', evidence: ['e'] });
    const rej = rejectRefactor(prop.refactor_id, 'low quality');
    expect(rej.status).toBe('rejected');
    expect(rej.reason).toBe('low quality');
    expect(existsSync(join(workdir, prop.target_file!))).toBe(false);
  });

  it('is idempotent', async () => {
    const { proposeRefactor, rejectRefactor } = await freshProposals();
    const prop = proposeRefactor({ claim: 'double reject', evidence: ['e'] });
    rejectRefactor(prop.refactor_id, 'r1');
    const second = rejectRefactor(prop.refactor_id, 'r2');
    expect(second.status).toBe('rejected');
    // First reason wins on idempotent re-reject.
    expect(second.reason).toBe('r1');
  });

  it('throws InvalidTransition when rejecting an accepted proposal', async () => {
    const { proposeRefactor, acceptRefactor, rejectRefactor, InvalidTransition } =
      await freshProposals();
    const prop = proposeRefactor({ claim: 'accept first', evidence: ['e'] });
    acceptRefactor(prop.refactor_id);
    expect(() => rejectRefactor(prop.refactor_id)).toThrow(InvalidTransition);
  });
});
