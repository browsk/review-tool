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
