import { resolve } from 'node:path';

/**
 * Resolve the writable data directory. Defaults to `<cwd>/data` but can be
 * redirected with `MEMRAILS_DATA_DIR` so tests (and ephemeral deploys) get an
 * isolated, disposable store instead of polluting the committed `data/`.
 */
export function dataDir(): string {
  return process.env.MEMRAILS_DATA_DIR
    ? resolve(process.env.MEMRAILS_DATA_DIR)
    : resolve(process.cwd(), 'data');
}

export function dataPath(...segments: string[]): string {
  return resolve(dataDir(), ...segments);
}
