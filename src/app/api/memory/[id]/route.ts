import { NextResponse } from 'next/server';
import { getRecord, forget } from '@/lib/memory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const record = getRecord(params.id, { force: true });
  if (!record) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(record);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const record = getRecord(params.id, { force: true });
  if (!record) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const url = new URL(req.url);
  const reason = url.searchParams.get('reason') ?? undefined;
  const result = forget(params.id, { reason, changed_by: 'api' });
  return NextResponse.json(result);
}
