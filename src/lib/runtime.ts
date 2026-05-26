import { resolve } from 'node:path';

export function dataRoot(): string {
  const override = process.env.DATA_DIR;
  if (override && override.length > 0) return resolve(override);
  return resolve(process.cwd(), 'data');
}
