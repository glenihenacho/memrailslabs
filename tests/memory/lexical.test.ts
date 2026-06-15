import { describe, it, expect } from 'vitest';
import { stem, stemSet, computeIdf, weightedOverlap, literalCoverage } from '@/lib/memory/lexical';

describe('stemming — morphological variants collapse', () => {
  const families: Record<string, string[]> = {
    retrieve: ['retrieve', 'retrieval', 'retrieves', 'retrieving', 'retrieved'],
    price: ['price', 'pricing', 'priced', 'prices'],
    memory: ['memory', 'memories'],
    packet: ['packet', 'packets'],
    compress: ['compress', 'compression', 'compressed'],
    govern: ['govern', 'governed', 'governing'],
  };

  for (const [name, words] of Object.entries(families)) {
    it(`collapses the "${name}" family to one stem`, () => {
      const stems = new Set(words.map(stem));
      expect(stems.size).toBe(1);
    });
  }

  it('leaves short words untouched', () => {
    expect(stem('api')).toBe('api');
    expect(stem('sql')).toBe('sql');
  });
});

describe('IDF weighting — rare terms count more', () => {
  it('weighs a term in one doc above a term in every doc', () => {
    const docs = [stemSet('pricing retrieval'), stemSet('pricing tree'), stemSet('pricing scope')];
    const idf = computeIdf(docs);
    // "pricing" is in all three docs; "retrieval" in one — rare wins.
    expect((idf.get('retriev') ?? 0)).toBeGreaterThan(idf.get('pric') ?? 0);
  });
});

describe('weighted overlap — normalized to [0, 1]', () => {
  const docs = [stemSet('governed retrieval pricing'), stemSet('hot cache rail')];
  const idf = computeIdf(docs);

  it('is 1 when the doc covers the whole query weight', () => {
    expect(weightedOverlap(stemSet('governed retrieval'), docs[0], idf)).toBe(1);
  });

  it('is 0 with no overlap', () => {
    expect(weightedOverlap(stemSet('quokka kebab'), docs[0], idf)).toBe(0);
  });

  it('matches morphological variants (retrieving ~ retrieval)', () => {
    expect(weightedOverlap(stemSet('retrieving'), docs[0], idf)).toBeGreaterThan(0);
  });
});

describe('literal coverage — the rigorous grep signal', () => {
  it('scores a literal phrase match as 1', () => {
    expect(literalCoverage('packet contract', 'the packet contract is stable')).toBe(1);
  });

  it('is the fraction of distinct query words present verbatim', () => {
    // 3 of 4 query words appear; "delta" does not.
    expect(literalCoverage('alpha bravo charlie delta', 'alpha bravo charlie')).toBe(0.75);
  });

  it('is unstemmed — morphological variants do NOT count', () => {
    // "retrieval" is present but the query word "retrieving" is not verbatim.
    expect(literalCoverage('retrieving', 'governed retrieval pipeline')).toBe(0);
  });

  it('is 0 with no overlap', () => {
    expect(literalCoverage('quokka kebab', 'pricing and retrieval')).toBe(0);
  });
});
