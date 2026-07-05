#!/usr/bin/env tsx
/**
 * Dual-run diff job (conversion phase C2).
 *
 *   npm run authority:diff
 *
 * Compares the governed registry and retrieve() results between the file
 * backend and the Postgres authority. Run during the dual-run window (and
 * after `authority:migrate`) — the flip to Postgres-by-default is earned by
 * this reporting zero differences, not by hope. Exits 1 on any divergence.
 */
import { loadRegistry, invalidateRegistry } from '@/lib/memory/registry';
import { retrieve } from '@/lib/memory/retrieve';
import { ensureAuthorityReady, closeDb } from '@/lib/memory/authority';
import type { MemoryRecord } from '@/types/governed';
import type { ContextBundle } from '@/types/bundle';

const SAMPLE_QUERIES = [
  'retrieval architecture and governed pipeline',
  'pricing metered retrieval billing',
  'memory supersession lifecycle',
  'contract conformance portability',
];

/** The governance-relevant projection of a record. */
function fingerprintRecord(r: MemoryRecord) {
  return JSON.stringify({
    status: r.status,
    confidence: r.confidence,
    sensitivity: r.sensitivity,
    superseded_by: r.superseded_by ?? null,
    current_version: r.current_version,
    content: r.content,
    index_path: r.index_path,
  });
}

function fingerprintBundle(b: ContextBundle, excludeOmitted: Set<string>) {
  return JSON.stringify({
    memories: b.memories
      .map((m) => ({ id: m.memory_id, s: m.status, c: m.confidence }))
      .sort((a, z) => a.id.localeCompare(z.id)),
    omitted: b.omitted
      .filter((o) => !excludeOmitted.has(o.memory_id))
      .sort((a, z) => a.memory_id.localeCompare(z.memory_id)),
  });
}

async function snapshotBackend(mode: 'file' | 'postgres', excludeOmitted: Set<string>) {
  process.env.MEMRAILS_AUTHORITY = mode;
  invalidateRegistry();
  await ensureAuthorityReady();
  const records = loadRegistry({ force: true });
  const registry = new Map(records.map((r) => [r.memory_id, fingerprintRecord(r)]));
  const bundles = SAMPLE_QUERIES.map((q) =>
    fingerprintBundle(retrieve({ task_context: q }), excludeOmitted),
  );
  return { records, registry, bundles };
}

async function main() {
  // §6: tombstone bodies do not migrate (id + events only), so a tombstoned
  // record's registry row and audit-omission line exist only on the file
  // side. That divergence is by design — carve it out of both comparisons.
  process.env.MEMRAILS_AUTHORITY = 'file';
  invalidateRegistry();
  const tombstoned = new Set(
    loadRegistry({ force: true })
      .filter((r) => r.status === 'tombstoned')
      .map((r) => r.memory_id),
  );

  const file = await snapshotBackend('file', tombstoned);
  const pg = await snapshotBackend('postgres', tombstoned);

  const diffs: string[] = [];
  for (const [id, fp] of file.registry) {
    if (!pg.registry.has(id)) {
      if (!tombstoned.has(id)) diffs.push(`missing in postgres: ${id}`);
    } else if (pg.registry.get(id) !== fp) {
      diffs.push(`mismatch: ${id}\n  file: ${fp}\n  pg:   ${pg.registry.get(id)}`);
    }
  }
  for (const id of pg.registry.keys()) {
    if (!file.registry.has(id)) diffs.push(`missing in file: ${id}`);
  }
  SAMPLE_QUERIES.forEach((q, i) => {
    if (file.bundles[i] !== pg.bundles[i]) {
      diffs.push(`retrieve divergence for "${q}"\n  file: ${file.bundles[i]}\n  pg:   ${pg.bundles[i]}`);
    }
  });

  if (diffs.length > 0) {
    console.error(`[diff] ${diffs.length} divergence(s) between file and postgres authorities:\n`);
    for (const d of diffs) console.error(`  ✗ ${d}`);
    process.exit(1);
  }
  console.log(
    `[diff] ✓ backends agree — ${file.registry.size} registry records, ${SAMPLE_QUERIES.length} retrieve fingerprints identical.`,
  );
  await closeDb(); // release the PGlite handle so the process can exit
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
