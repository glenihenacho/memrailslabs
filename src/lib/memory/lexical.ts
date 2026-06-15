/**
 * Shared lexical retrieval primitives — the deterministic, model-free core that
 * the governed relevance signal (L1–L3) is built on.
 *
 * Two upgrades over raw token overlap:
 *   1. Stemming — morphological variants collapse to a shared stem, so
 *      `retrieve / retrieval / retrieves / retrieving / retrieved` all match.
 *   2. IDF weighting — rare terms count more than common ones (BM25-lite), so a
 *      query's distinctive words drive the match instead of filler.
 *
 * Everything here is pure and synchronous: no network, no embeddings, no model.
 */

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has',
  'have', 'in', 'is', 'it', 'of', 'on', 'or', 'the', 'to', 'was', 'were',
  'with', 'what', 'how', 'when', 'why', 'do', 'does', 'this', 'that', 'i',
  'detail', 'build', 'complete',
]);

/** Unknown query terms (not seen in the corpus) still carry a modest weight. */
const FALLBACK_IDF = 1.0;

/** Raw tokenizer — lowercase, strip punctuation, drop stopwords and 1-char noise. */
export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Strip a suffix only when the remaining stem stays meaningful (≥ 3 chars). */
function strip(word: string, suffix: string, replacement = ''): string | null {
  if (!word.endsWith(suffix)) return null;
  const base = word.slice(0, word.length - suffix.length) + replacement;
  return base.length >= 3 ? base : null;
}

/**
 * Conservative, deterministic stemmer. Not full Porter — tuned to collapse the
 * morphology that actually shows up in technical memory (verb forms, plurals,
 * common nominalizers) without over-stemming short words.
 */
export function stem(word: string): string {
  if (word.length <= 3) return word;
  let s = word.replace(/(?:'s|')$/, '');

  // Verb forms first: gerund / past tense.
  s = strip(s, 'ing') ?? s;
  if (!word.match(/ing$/)) s = strip(s, 'edly') ?? strip(s, 'ed') ?? s;

  // Plurals.
  s = strip(s, 'ies', 'y') ?? s; // memories → memory, policies → policy
  if (!s.endsWith('ss')) {
    s = strip(s, 'es') ?? strip(s, 's') ?? s; // prices → pric, packets → packet
  }

  // Nominalizers / adjectival endings (single pass, longest first).
  s =
    strip(s, 'ization', 'ize') ??
    strip(s, 'ation') ??
    strip(s, 'ition') ??
    strip(s, 'ion') ?? // compression → compress
    strip(s, 'ment') ??
    strip(s, 'ness') ??
    strip(s, 'ity') ??
    strip(s, 'ive') ??
    strip(s, 'al') ?? // retrieval → retriev
    s;

  // Finally drop a trailing silent 'e' (retrieve → retriev, evidence → evidenc).
  if (s.length > 4) s = strip(s, 'e') ?? s;

  return s;
}

/** Tokenize then stem. */
export function stemTokens(s: string): string[] {
  return tokenize(s).map(stem);
}

/** Distinct stems of a string. */
export function stemSet(s: string): Set<string> {
  return new Set(stemTokens(s));
}

/**
 * Inverse document frequency over a set of documents (each a stem set).
 * `idf = ln(1 + N / df)` — a term in every doc tends to 0; a rare term is large.
 */
export function computeIdf(docStemSets: Set<string>[]): Map<string, number> {
  const N = docStemSets.length || 1;
  const df = new Map<string, number>();
  for (const set of docStemSets) {
    for (const t of set) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const idf = new Map<string, number>();
  for (const [t, d] of df) idf.set(t, Number(Math.log(1 + N / d).toFixed(4)));
  return idf;
}

/**
 * IDF-weighted overlap: the share of the query's *weight* (not its raw token
 * count) that the document covers. Returns a value in [0, 1].
 */
export function weightedOverlap(
  queryStems: Set<string>,
  docStems: Set<string>,
  idf: Map<string, number>,
): number {
  if (queryStems.size === 0) return 0;
  let denom = 0;
  let num = 0;
  for (const t of queryStems) {
    const w = idf.get(t) ?? FALLBACK_IDF;
    denom += w;
    if (docStems.has(t)) num += w;
  }
  return denom === 0 ? 0 : Number((num / denom).toFixed(4));
}

/**
 * Rigorous literal coverage — the L1 grep signal. Deliberately *unstemmed* and
 * whole-word: a literal phrase match scores 1; otherwise it is the fraction of
 * the query's distinct words present verbatim in the text. No morphology, no
 * embeddings — this is the cheap evidence that, when strong, lets retrieval
 * skip the semantic blend entirely.
 */
export function literalCoverage(queryRaw: string, text: string): number {
  const qWords = new Set(tokenize(queryRaw));
  if (qWords.size === 0) return 0;
  const haystack = text.toLowerCase();
  const phrase = queryRaw.trim().toLowerCase();
  if (phrase.length > 2 && haystack.includes(phrase)) return 1;
  const hWords = new Set(tokenize(text));
  let matched = 0;
  for (const w of qWords) if (hWords.has(w)) matched += 1;
  return Number((matched / qWords.size).toFixed(4));
}
