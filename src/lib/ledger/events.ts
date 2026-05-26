import { randomUUID } from 'node:crypto';
import type { LedgerEvent, LedgerEventType } from '@/types/ledger';
import type { MemoryPacket } from '@/types/packet';
import type { Voucher } from '@/types/payments';
import { appendEvent } from './jsonl';

export function logEvent(
  type: LedgerEventType,
  metadata: Record<string, unknown>,
  extra: Partial<LedgerEvent> = {},
): LedgerEvent {
  const event: LedgerEvent = {
    event_id: `evt_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    event_type: type,
    metadata,
    created_at: new Date().toISOString(),
    ...extra,
  };
  appendEvent(event);
  return event;
}

export function logPacket(
  packet: MemoryPacket,
  latency_ms: number,
  voucher?: Voucher | null,
): void {
  logEvent('QUERY', { query: packet.query, latency_ms, layer: packet.resolved_layer });
  const packetExtra: Partial<LedgerEvent> = {
    packet_id: packet.packet_id,
    input_hash: packet.input_hash,
    output_hash: packet.output_hash,
  };
  if (voucher) {
    packetExtra.session_id = voucher.session_id;
    packetExtra.cost_cents = voucher.debit_cents;
  }
  logEvent(
    'PACKET_CREATED',
    {
      query: packet.query,
      layer: packet.resolved_layer,
      tokens: packet.tokens,
      confidence: packet.confidence,
      latency_ms,
    },
    packetExtra,
  );
}
