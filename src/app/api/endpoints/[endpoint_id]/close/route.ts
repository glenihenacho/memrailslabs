import { NextResponse } from 'next/server';
import { closeEndpoint, EndpointNotFound } from '@/lib/endpoints/deploy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: { endpoint_id: string } },
) {
  try {
    const endpoint = closeEndpoint(params.endpoint_id);
    return NextResponse.json(endpoint);
  } catch (err) {
    if (err instanceof EndpointNotFound) {
      return NextResponse.json({ error: 'endpoint_not_found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'internal_error', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
