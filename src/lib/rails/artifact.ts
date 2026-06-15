/**
 * Artifact Rail — packets, evidence, exports, snapshots.
 *
 * The MVP persists artifacts to the local filesystem (`data/artifacts/`); a real
 * deploy swaps in S3 / R2 / MinIO behind the same `put`/`get` interface. Keys
 * are namespaced per owner so artifacts stay tenant-isolated like the rest of
 * the federation.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { dataPath } from '@/lib/paths';

export interface ArtifactRail {
  put(ownerId: string, key: string, body: string): string;
  get(ref: string): string | null;
}

class FileArtifactRail implements ArtifactRail {
  private base(): string {
    return dataPath('artifacts');
  }

  put(ownerId: string, key: string, body: string): string {
    const rel = join(ownerId, key);
    const abs = join(this.base(), rel);
    if (!existsSync(dirname(abs))) mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body, 'utf8');
    return `artifact://${rel}`;
  }

  get(ref: string): string | null {
    const rel = ref.replace(/^artifact:\/\//, '');
    const abs = join(this.base(), rel);
    return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
  }
}

export const artifactRail: ArtifactRail = new FileArtifactRail();
