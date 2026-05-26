import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { MemoryPacket } from '@/types/packet';
import { dataRoot } from '@/lib/runtime';

const PACKET_ID_PATTERN = /^pkt_[a-z0-9]{6,32}$/;

export function packetsDir(): string {
  return resolve(dataRoot(), 'packets');
}

export function savePacket(packet: MemoryPacket): void {
  const dir = packetsDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const path = resolve(dir, `${packet.packet_id}.json`);
  writeFileSync(path, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
}

export function loadPacket(packet_id: string): MemoryPacket | null {
  // Reject anything that doesn't look like a packet id to prevent path traversal.
  if (!PACKET_ID_PATTERN.test(packet_id)) return null;
  const path = resolve(packetsDir(), `${packet_id}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as MemoryPacket;
  } catch {
    return null;
  }
}
