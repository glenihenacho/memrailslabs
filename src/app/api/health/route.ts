import { NextResponse } from 'next/server';
import { dataRoot } from '@/lib/runtime';
import { loadCorpus } from '@/lib/memory/corpus';
import { withCors, corsOptions } from '@/lib/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withCors(async () => {
  let corpus_keys = 0;
  try {
    corpus_keys = loadCorpus().length;
  } catch {
    // a failed corpus load shouldn't make health fail outright
  }
  return NextResponse.json({
    ok: true,
    commit: process.env.GIT_COMMIT ?? 'dev',
    data_dir: dataRoot(),
    corpus_keys,
  });
});

export const OPTIONS = () => corsOptions();
