import { describe, expect, it } from 'vitest';
import { reanchor } from '../../src/shared/anchor.js';

const mk = (text: string, quote: string, at: number, ctx = 32) => ({
  start: at,
  end: at + quote.length,
  quote,
  prefix: text.slice(Math.max(0, at - ctx), at),
  suffix: text.slice(at + quote.length, at + quote.length + ctx),
});

describe('reanchor', () => {
  const original = 'The system stores data. The cache stores data. Reviews happen weekly.';

  it('keeps offsets when they still select the quote', () => {
    const a = mk(original, 'cache', original.indexOf('cache'));
    expect(reanchor(original, a)).toEqual({ start: a.start, end: a.end, method: 'offset' });
  });

  it('re-attaches by quote when offsets are stale and the quote is unique', () => {
    const a = mk(original, 'Reviews happen', original.indexOf('Reviews'));
    const edited = 'INSERTED PARAGRAPH. ' + original;
    const r = reanchor(edited, a)!;
    expect(r.method).toBe('quote');
    expect(edited.slice(r.start, r.end)).toBe('Reviews happen');
  });

  it('uses prefix/suffix to pick the right occurrence when the quote is ambiguous', () => {
    const a = mk(original, 'stores data', original.lastIndexOf('stores data'));
    const edited = 'Extra intro sentence here. ' + original;
    const r = reanchor(edited, a)!;
    expect(r.method).toBe('context');
    expect(r.start).toBe(edited.lastIndexOf('stores data'));
    const first = mk(original, 'stores data', original.indexOf('stores data'));
    expect(reanchor(edited, first)!.start).toBe(edited.indexOf('stores data'));
  });

  it('falls back to the occurrence nearest the old offset when context does not help', () => {
    const text = 'xx foo yy ... zz foo ww';
    const a = { start: 18, end: 21, quote: 'foo', prefix: 'QQQ', suffix: 'RRR' };
    const r = reanchor(text, a)!;
    expect(r.method).toBe('nearest');
    expect(r.start).toBe(text.lastIndexOf('foo'));
  });

  it('returns null (orphaned) when the quote is gone', () => {
    const a = mk(original, 'Reviews happen', original.indexOf('Reviews'));
    expect(reanchor('Completely different text.', a)).toBeNull();
  });

  it('is tolerant of CRLF in quotes that came through a CSV', () => {
    const text = 'line one\nline two';
    const a = { start: 0, end: 17, quote: 'line one\r\nline two', prefix: '', suffix: '' };
    expect(reanchor(text, a)).toMatchObject({ start: 0, end: 17 });
  });

  it('never matches an empty quote', () => {
    expect(reanchor('abc', { start: 0, end: 0, quote: '', prefix: '', suffix: '' })).toBeNull();
  });
});

import { reanchorDiagram } from '../../src/shared/anchor.js';

describe('reanchorDiagram', () => {
  const d = (start: number, source: string) => ({ start, end: start + 1, source });
  it('finds a diagram by its source, whatever its new position', () => {
    const diagrams = [d(10, 'graph TD\n  A --> B'), d(80, 'a -> b')];
    expect(reanchorDiagram(diagrams, { start: 12, quote: 'a -> b' })).toEqual({ start: 80, end: 81, method: 'diagram' });
    expect(reanchorDiagram(diagrams, { start: 999, quote: 'graph TD\n  A --> B' })).toEqual({ start: 10, end: 11, method: 'diagram' });
  });
  it('ignores CRLF and trailing whitespace differences (CSV round-trips)', () => {
    expect(reanchorDiagram([d(5, 'a\nb')], { start: 0, quote: 'a\r\nb\r\n' })).toMatchObject({ start: 5 });
  });
  it('picks the nearest of several identical diagrams, and orphans a missing or empty one', () => {
    const diagrams = [d(10, 'same'), d(50, 'same'), d(90, 'same')];
    expect(reanchorDiagram(diagrams, { start: 55, quote: 'same' })!.start).toBe(50);
    expect(reanchorDiagram(diagrams, { start: 0, quote: 'edited' })).toBeNull();
    expect(reanchorDiagram(diagrams, { start: 0, quote: '  ' })).toBeNull();
  });
});
