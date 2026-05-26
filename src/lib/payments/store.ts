import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PaymentSession } from '@/types/payments';

const SESSIONS_DIR = resolve(process.cwd(), 'data', 'sessions');
const SESSION_ID_PATTERN = /^sess_[a-z0-9]{6,32}$/;

function ensureDir(): void {
  if (!existsSync(SESSIONS_DIR)) {
    mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

export function saveSession(session: PaymentSession): void {
  ensureDir();
  const path = resolve(SESSIONS_DIR, `${session.session_id}.json`);
  writeFileSync(path, `${JSON.stringify(session, null, 2)}\n`, 'utf8');
}

export function loadSession(session_id: string): PaymentSession | null {
  if (!SESSION_ID_PATTERN.test(session_id)) return null;
  const path = resolve(SESSIONS_DIR, `${session_id}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as PaymentSession;
  } catch {
    return null;
  }
}

export function listSessions(): PaymentSession[] {
  if (!existsSync(SESSIONS_DIR)) return [];
  const files = readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.json'));
  const out: PaymentSession[] = [];
  for (const f of files) {
    try {
      const raw = readFileSync(resolve(SESSIONS_DIR, f), 'utf8');
      out.push(JSON.parse(raw) as PaymentSession);
    } catch {
      // skip malformed
    }
  }
  out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return out;
}

export function sessionsDir(): string {
  return SESSIONS_DIR;
}
