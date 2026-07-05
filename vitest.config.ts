import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    // Isolated, disposable data dir so tests never pollute the committed
    // `data/` ledger, governance overlay, or written-memory store.
    env: {
      MEMRAILS_DATA_DIR: resolve(__dirname, '.tmp-test-data'),
    },
    // Test files share one on-disk data dir and reset it between cases, so they
    // must not run in parallel or one file's reset races another's writes.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
