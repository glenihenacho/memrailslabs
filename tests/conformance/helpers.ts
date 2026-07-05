import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { invalidateRegistry } from '@/lib/memory/registry';

/**
 * Shared conformance-suite reset: wipe the isolated test data dir (see
 * MEMRAILS_DATA_DIR in vitest.config.ts) and drop the registry cache so each
 * case starts from the canonical corpus with empty mutable stores.
 */
export function resetData(): void {
  rmSync(resolve(__dirname, '../../.tmp-test-data'), { recursive: true, force: true });
  invalidateRegistry();
}
