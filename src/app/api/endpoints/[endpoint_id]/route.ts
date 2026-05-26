import { NextResponse } from 'next/server';
import { loadEndpoint } from '@/lib/endpoints/store';
import { withCors, corsOptions } from '@/lib/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function _GET(
  _req: Request,
  { params }: { params: { endpoint_id: string } },
) {
  const endpoint = loadEndpoint(params.endpoint_id);
  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint_not_found' }, { status: 404 });
  }
  return NextResponse.json(endpoint);
}

export const GET = withCors(_GET);
export const OPTIONS = () => corsOptions();
