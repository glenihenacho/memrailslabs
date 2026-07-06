import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { invalidateRegistry } from '@/lib/memory/registry';
import { resetAuthorityForTests } from '@/lib/memory/authority';
import { hotMemories, hotRetrievals } from '@/lib/rails/hot';
import { graphRail } from '@/lib/rails/graph';
import { usageStats } from '@/lib/rails/usage';

/**
 * Shared conformance-suite reset: wipe the isolated test data dir (see
 * MEMRAILS_DATA_DIR in vitest.config.ts), clear the Postgres authority when
 * that backend is active (no-op in file mode), drop the registry cache, and
 * empty the live rail projections so each case starts from the canonical
 * corpus with empty mutable stores.
 */
export function resetData(): void {
  rmSync(resolve(__dirname, '../../.tmp-test-data'), { recursive: true, force: true });
  resetAuthorityForTests();
  invalidateRegistry();
  hotMemories.clear();
  hotRetrievals.clear();
  graphRail.clear();
  usageStats.clear();
}
