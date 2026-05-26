import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RefactorProposal } from '@/types/refactor';

const REFACTORS_DIR = resolve(process.cwd(), 'data', 'refactors');
const REFACTOR_ID_PATTERN = /^ref_[a-z0-9]{6,32}$/;

function ensureDir(): void {
  if (!existsSync(REFACTORS_DIR)) {
    mkdirSync(REFACTORS_DIR, { recursive: true });
  }
}

export function saveRefactor(proposal: RefactorProposal): void {
  ensureDir();
  const path = resolve(REFACTORS_DIR, `${proposal.refactor_id}.json`);
  writeFileSync(path, `${JSON.stringify(proposal, null, 2)}\n`, 'utf8');
}

export function loadRefactor(refactor_id: string): RefactorProposal | null {
  if (!REFACTOR_ID_PATTERN.test(refactor_id)) return null;
  const path = resolve(REFACTORS_DIR, `${refactor_id}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as RefactorProposal;
  } catch {
    return null;
  }
}

export function listRefactors(): RefactorProposal[] {
  if (!existsSync(REFACTORS_DIR)) return [];
  const files = readdirSync(REFACTORS_DIR).filter((f) => f.endsWith('.json'));
  const out: RefactorProposal[] = [];
  for (const f of files) {
    try {
      const raw = readFileSync(resolve(REFACTORS_DIR, f), 'utf8');
      out.push(JSON.parse(raw) as RefactorProposal);
    } catch {
      // skip malformed entries
    }
  }
  out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return out;
}

export function refactorsDir(): string {
  return REFACTORS_DIR;
}
