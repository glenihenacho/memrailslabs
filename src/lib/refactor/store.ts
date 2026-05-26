import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RefactorProposal } from '@/types/refactor';
import { dataRoot } from '@/lib/runtime';

const REFACTOR_ID_PATTERN = /^ref_[a-z0-9]{6,32}$/;

export function refactorsDir(): string {
  return resolve(dataRoot(), 'refactors');
}

function ensureDir(): void {
  const dir = refactorsDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function saveRefactor(proposal: RefactorProposal): void {
  ensureDir();
  const path = resolve(refactorsDir(), `${proposal.refactor_id}.json`);
  writeFileSync(path, `${JSON.stringify(proposal, null, 2)}\n`, 'utf8');
}

export function loadRefactor(refactor_id: string): RefactorProposal | null {
  if (!REFACTOR_ID_PATTERN.test(refactor_id)) return null;
  const path = resolve(refactorsDir(), `${refactor_id}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as RefactorProposal;
  } catch {
    return null;
  }
}

export function listRefactors(): RefactorProposal[] {
  const dir = refactorsDir();
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  const out: RefactorProposal[] = [];
  for (const f of files) {
    try {
      const raw = readFileSync(resolve(dir, f), 'utf8');
      out.push(JSON.parse(raw) as RefactorProposal);
    } catch {
      // skip malformed entries
    }
  }
  out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return out;
}
