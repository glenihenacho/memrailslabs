#!/usr/bin/env tsx
/**
 * File-canonical → Postgres authority migration (conversion phase C2).
 *
 *   npm run authority:migrate            # migrate into MEMRAILS_PG_DIR (or data/authority)
 *
 * Dogfoods the §6 portability path: the governed record set travels through
 * `exportRecords` → `importRecords` — the same tool a cross-runtime migration
 * uses. Two things §6 deliberately withholds are then copied directly,
 * because this is a same-owner authority move, not a boundary crossing:
 *
 *   1. `restricted` records (never exported) — copied straight into the store.
 *   2. The exact governance overlay (disputed_reason, tombstoned_at, ...) —
 *      reconciled entry-by-entry so governance parity is exact, not merely
 *      behavioral.
 *
 * Tombstoned record *bodies* are not migrated (§6: tombstones travel as id +
 * events) — the fresh authority holds no content for forgotten memories.
 *
 * Verify afterwards with `npm run authority:diff`.
 */
import { exportRecords, importRecords } from '@/lib/memory/records';
import { readWritten } from '@/lib/memory/store';
import { loadOverlay, upsertEntry } from '@/lib/memory/governance';
import { appendWritten } from '@/lib/memory/store';
import { invalidateRegistry } from '@/lib/memory/registry';
import { ensureAuthorityReady, flushAuthority, closeDb } from '@/lib/memory/authority';

async function main() {
  // 1. Read everything from the file backend.
  process.env.MEMRAILS_AUTHORITY = 'file';
  invalidateRegistry();
  const { jsonl, stats } = exportRecords({ include_sensitive: true });
  const restricted = readWritten({ force: true }).filter(
    (r) => r.sensitivity === 'restricted' && r.status !== 'tombstoned',
  );
  const fileOverlay = loadOverlay({ force: true });
  console.log(
    `[migrate] file backend: ${stats.records} records, ${stats.tombstones} tombstones, ` +
      `${restricted.length} restricted (direct copy), ${Object.keys(fileOverlay).length} overlay entries`,
  );

  // 2. Import into the Postgres authority.
  process.env.MEMRAILS_AUTHORITY = 'postgres';
  invalidateRegistry();
  await ensureAuthorityReady();

  const report = importRecords(jsonl);
  for (const record of restricted) appendWritten(record);
  for (const [memory_id, entry] of Object.entries(fileOverlay)) {
    upsertEntry(memory_id, () => entry);
  }
  await flushAuthority();

  console.log(
    `[migrate] postgres authority: imported ${report.imported}, reconciled ${report.reconciled}, ` +
      `tombstones ${report.tombstones_applied}, below-floor ${report.below_floor.length}, errors ${report.errors}`,
  );
  console.log('[migrate] done — run `npm run authority:diff` to verify parity.');
  await closeDb(); // release the PGlite handle so the process can exit
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
