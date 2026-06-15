import { NextResponse } from 'next/server';
import { memoryMap } from '@/lib/memory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const project = url.searchParams.get('project_id') ?? 'project_memrails';
  return NextResponse.json({ project_id: project, map: memoryMap(project) });
}
