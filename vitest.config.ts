import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Isolated, disposable data dir so tests never pollute the committed
    // `data/` ledger, governance overlay, or written-memory store.
    env: {
      MEMRAILS_DATA_DIR: resolve(__dirname, '.tmp-test-data'),
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
