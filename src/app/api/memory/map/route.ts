import { NextResponse } from 'next/server';
import { memoryMap } from '@/lib/memory';
import { authenticate, authErrorResponse } from '@/lib/auth/authenticate';
import { ensureAuthorityReady } from '@/lib/memory/authority';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  let owner_id: string;
  try {
    owner_id = authenticate(req).owner_id;
  } catch (err) {
    return authErrorResponse(err);
  }
  await ensureAuthorityReady();
  const url = new URL(req.url);
  const project = url.searchParams.get('project_id') ?? 'project_memrails';
  return NextResponse.json({ project_id: project, map: memoryMap(project, owner_id) });
}
