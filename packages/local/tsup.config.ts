import { defineConfig } from 'tsup';

/**
 * @memrails/local build (C7.1). Bundles the kernel contract surface from the
 * repository sources into a self-contained package: ESM + CJS + bundled
 * declarations. Real runtime dependencies (embedded Postgres, frontmatter
 * parsing) stay external and are declared in the package manifest.
 */
export default defineConfig({
  entry: { index: 'packages/local/src/index.ts' },
  outDir: 'packages/local/dist',
  format: ['esm', 'cjs'],
  dts: true,
  platform: 'node',
  target: 'node18',
  tsconfig: 'packages/local/tsconfig.build.json',
  external: ['@electric-sql/pglite', 'gray-matter'],
  // The package manifest is `type: module`: `.js` must be ESM, `.cjs` CJS —
  // regardless of the repo root's CommonJS default that tsup would infer.
  outExtension: ({ format }) => ({ js: format === 'cjs' ? '.cjs' : '.js' }),
  sourcemap: false,
  clean: true,
});
