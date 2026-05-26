import { NextResponse } from 'next/server';
import { deployEndpoint, InvalidCorpusPath } from '@/lib/endpoints/deploy';
import { listEndpoints } from '@/lib/endpoints/store';
import { EndpointDeployInputSchema } from '@/lib/memory/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 64 * 1024;

export async function GET() {
  return NextResponse.json({ endpoints: listEndpoints() });
}

export async function POST(req: Request) {
  const declaredSize = Number(req.headers.get('content-length') ?? '0');
  if (declaredSize > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
  }

  let json: unknown = {};
  const raw = await req.text();
  if (raw.length > 0) {
    try {
      json = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }
  }

  const parsed = EndpointDeployInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_input', issues: parsed.error.issues },
      { status: 422 },
    );
  }

  try {
    const endpoint = await deployEndpoint(parsed.data);
    return NextResponse.json(endpoint, { status: 201 });
  } catch (err) {
    if (err instanceof InvalidCorpusPath) {
      return NextResponse.json(
        { error: 'invalid_corpus_path', corpus_path: parsed.data.corpus_path },
        { status: 422 },
      );
    }
    return NextResponse.json(
      { error: 'internal_error', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
