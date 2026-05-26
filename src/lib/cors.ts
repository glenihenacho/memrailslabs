import { NextResponse } from 'next/server';

type AnyHandler = (...args: any[]) => Promise<Response> | Response;

const DEFAULT_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function originHeader(req: Request | undefined): string {
  const origin = req?.headers.get('origin') ?? '';
  const allow = (process.env.ALLOWED_ORIGINS ?? '*').split(',').map((s) => s.trim());
  if (allow.includes('*')) return '*';
  return allow.includes(origin) ? origin : allow[0] ?? '';
}

function applyHeaders(res: Response, origin: string): Response {
  res.headers.set('Access-Control-Allow-Origin', origin);
  for (const [k, v] of Object.entries(DEFAULT_HEADERS)) res.headers.set(k, v);
  return res;
}

export function withCors<H extends AnyHandler>(handler: H): H {
  const wrapped = async (...args: Parameters<H>): Promise<Response> => {
    const req = args[0] as Request | undefined;
    const origin = originHeader(req);
    if (req?.method === 'OPTIONS') {
      return applyHeaders(new NextResponse(null, { status: 204 }), origin);
    }
    const res = await handler(...args);
    return applyHeaders(res, origin);
  };
  return wrapped as unknown as H;
}

export function corsOptions(): Response {
  return applyHeaders(new NextResponse(null, { status: 204 }), '*');
}
