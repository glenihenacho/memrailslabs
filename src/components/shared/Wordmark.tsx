import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

let cached: string | null = null;

function loadWordmark(): string {
  if (cached !== null) return cached;
  const path = resolve(process.cwd(), 'src', 'marketing', 'wordmark.svg.html');
  cached = existsSync(path) ? readFileSync(path, 'utf8') : '';
  return cached;
}

export function Wordmark({ className }: { className?: string }) {
  const svg = loadWordmark();
  if (!svg) {
    return (
      <span className="font-display font-semibold tracking-tight" style={{ color: 'var(--signal)' }}>
        memrails
      </span>
    );
  }
  return <span className={className} dangerouslySetInnerHTML={{ __html: svg }} />;
}
