import { NextResponse } from 'next/server';
import { RAILS, coreRails, CANONICAL_LINE } from '@/lib/rails/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Inspectable canonical stack. Shows every rail, its plane (global vs
 * per-owner), the provider serving it today, and what it graduates to.
 */
export async function GET() {
  return NextResponse.json({
    summary: CANONICAL_LINE,
    core: coreRails().map((r) => r.id),
    global_plane: RAILS.filter((r) => r.scope === 'global').map((r) => r.id),
    per_owner_plane: RAILS.filter((r) => r.scope === 'per_owner').map((r) => r.id),
    rails: RAILS,
  });
}
