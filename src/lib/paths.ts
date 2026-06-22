import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Resolve the writable data directory. Defaults to `<cwd>/data` but can be
 * redirected with `MEMRAILS_DATA_DIR` so tests (and ephemeral deploys) get an
 * isolated, disposable store instead of polluting the committed `data/`.
 *
 * On Vercel the deployed filesystem is read-only except for the OS temp dir, so
 * fall back to a temp-backed store there. This is per-instance and ephemeral —
 * fine for the marketing site + read-only demo tenant; durable persistence
 * (Postgres/KV) is a follow-up if stateful production is needed.
 */
export function dataDir(): string {
  if (process.env.MEMRAILS_DATA_DIR) return resolve(process.env.MEMRAILS_DATA_DIR);
  if (process.env.VERCEL) return resolve(tmpdir(), 'memrails-data');
  return resolve(process.cwd(), 'data');
}

/** Resolve a path inside the writable data directory (see {@link dataDir}). */
export function dataPath(...segments: string[]): string {
  return resolve(dataDir(), ...segments);
}
