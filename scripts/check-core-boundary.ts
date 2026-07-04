#!/usr/bin/env tsx
/**
 * Kernel boundary check (conversion phase C0).
 *
 * The governed kernel — `@memrails/core` in spirit: `src/types`,
 * `src/lib/memory`, `src/lib/ledger`, `src/lib/rails`, plus the neutral
 * `paths`/`observability` utilities and the federation storage plane — must
 * import nothing from the product shell (`app/`, `components/`, `billing/`,
 * `accounts/`, `auth/`, `pricing/`, `mcp/`). Enforced as a whitelist: every
 * `@/` or relative import from a kernel file must resolve back into the
 * kernel. Combined with `tsc -p tsconfig.core.json` this proves the kernel
 * builds standalone.
 *
 * Run: npm run core:check
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';

const ROOT = resolve(__dirname, '..');

const CORE_DIRS = [
  'src/types',
  'src/lib/memory',
  'src/lib/ledger',
  'src/lib/rails',
  'src/lib/federation',
  'src/lib/observability',
];
const CORE_FILES = ['src/lib/paths.ts'];

/** Alias prefixes a kernel file may import from. */
const ALLOWED_ALIAS_PREFIXES = [
  '@/types/',
  '@/lib/memory/',
  '@/lib/ledger/',
  '@/lib/rails/',
  '@/lib/federation/',
  '@/lib/observability/',
  '@/lib/paths',
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) out.push(...walk(abs));
    else if (/\.tsx?$/.test(entry)) out.push(abs);
  }
  return out;
}

function coreFiles(): string[] {
  return [
    ...CORE_DIRS.flatMap((d) => walk(join(ROOT, d))),
    ...CORE_FILES.map((f) => join(ROOT, f)),
  ];
}

function isWithinCore(absPath: string): boolean {
  const rel = relative(ROOT, absPath).replace(/\\/g, '/');
  return (
    CORE_DIRS.some((d) => rel === d || rel.startsWith(`${d}/`)) ||
    CORE_FILES.some((f) => rel === f || rel === f.replace(/\.ts$/, ''))
  );
}

const IMPORT_RE = /(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

const violations: string[] = [];

for (const file of coreFiles()) {
  const src = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file);
  for (const match of src.matchAll(IMPORT_RE)) {
    const spec = match[1] ?? match[2];
    if (!spec) continue;
    if (spec.startsWith('node:')) continue; // node builtins
    if (spec.startsWith('@/')) {
      if (!ALLOWED_ALIAS_PREFIXES.some((p) => spec === p || spec.startsWith(p) || `${spec}/` === p || spec === p.replace(/\/$/, ''))) {
        violations.push(`${rel}: forbidden import '${spec}' (kernel must not depend on the shell)`);
      }
      continue;
    }
    if (spec.startsWith('.')) {
      const resolved = resolve(dirname(file), spec);
      if (!isWithinCore(resolved) && !isWithinCore(`${resolved}.ts`)) {
        violations.push(`${rel}: relative import '${spec}' escapes the kernel`);
      }
      continue;
    }
    // Bare package imports (npm deps) are allowed.
  }
}

if (violations.length > 0) {
  console.error('Kernel boundary violations:\n');
  for (const v of violations) console.error(`  ✗ ${v}`);
  console.error(`\n${violations.length} violation(s). The kernel imports nothing from app/, billing/, accounts/, auth/, pricing/, mcp/, components/.`);
  process.exit(1);
}

console.log(`✓ kernel boundary clean (${coreFiles().length} files checked)`);
