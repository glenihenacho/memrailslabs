import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { MemoryPacket } from '@/types/packet';

const PACKETS_DIR = resolve(process.cwd(), 'data', 'packets');
const PACKET_ID_PATTERN = /^pkt_[a-z0-9]{6,32}$/;

export function savePacket(packet: MemoryPacket): void {
  if (!existsSync(PACKETS_DIR)) {
    mkdirSync(PACKETS_DIR, { recursive: true });
  }
  const path = resolve(PACKETS_DIR, `${packet.packet_id}.json`);
  writeFileSync(path, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
}

export function loadPacket(packet_id: string): MemoryPacket | null {
  // Reject anything that doesn't look like a packet id to prevent path traversal.
  if (!PACKET_ID_PATTERN.test(packet_id)) return null;
  const path = resolve(PACKETS_DIR, `${packet_id}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as MemoryPacket;
  } catch {
    return null;
  }
}

export function packetsDir(): string {
  return PACKETS_DIR;
}
