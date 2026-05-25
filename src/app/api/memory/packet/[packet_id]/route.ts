import { NextResponse } from 'next/server';
import { loadPacket } from '@/lib/memory/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { packet_id: string } },
) {
  const packet = loadPacket(params.packet_id);
  if (!packet) {
    return NextResponse.json({ error: 'packet_not_found' }, { status: 404 });
  }
  return NextResponse.json(packet);
}
