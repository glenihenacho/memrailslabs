import { createHash } from 'node:crypto';

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has',
  'have', 'in', 'is', 'it', 'of', 'on', 'or', 'the', 'to', 'was', 'were',
  'with', 'what', 'how', 'when', 'why', 'do', 'does', 'this', 'that', 'i',
]);

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

// Light deterministic stemmer — 8 rules covering the most common English
// suffix collapses. Sufficient for query normalization; real stemming swaps
// in behind the same `normalize` surface if Phase 3 clustering needs it.
function stem(t: string): string {
  if (t.length <= 3) return t;
  const rules: Array<[RegExp, string]> = [
    [/ies$/, 'y'],
    [/sses$/, 'ss'],
    [/ization$/, 'ize'],
    [/ational$/, 'ate'],
    [/ing$/, ''],
    [/edly$/, ''],
    [/ed$/, ''],
    [/ly$/, ''],
    // Trailing -s only when not preceded by another s (preserves "compress",
    // "address"); -us/-is also preserved by general semantics.
    [/(?<!s)s$/, ''],
  ];
  for (const [re, repl] of rules) {
    if (re.test(t)) {
      const stemmed = t.replace(re, repl);
      if (stemmed.length >= 3) return stemmed;
    }
  }
  return t;
}

export function normalize(s: string): string {
  return tokenize(s).map(stem).sort().join(' ');
}

export function contentHash(normalized: string): string {
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}
