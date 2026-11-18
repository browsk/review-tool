import { describe, expect, it } from 'vitest';
import { assignLayers, MAX_LAYERS } from '../../src/shared/layers.js';

const S = (id: string, start: number, end: number) => ({ id, start, end });
const L = (spans: ReturnType<typeof S>[], max?: number) => Object.fromEntries(assignLayers(spans, max));

describe('assignLayers', () => {
  it('puts non-overlapping spans in the same layer', () => {
    expect(L([S('a', 0, 5), S('b', 5, 9), S('c', 20, 30)])).toEqual({ a: 0, b: 0, c: 0 });
  });

  it('puts overlapping spans in different layers so tints stack', () => {
    expect(L([S('a', 0, 10), S('b', 5, 15)])).toEqual({ a: 0, b: 1 });
  });

  it('reuses a lower layer once its span has ended', () => {
    expect(L([S('a', 0, 10), S('b', 5, 15), S('c', 10, 20)])).toEqual({ a: 0, b: 1, c: 0 });
  });

  it('handles identical spans and nesting', () => {
    expect(L([S('a', 0, 10), S('b', 0, 10), S('c', 2, 4)])).toEqual({ a: 0, b: 1, c: 2 });
  });

  it('never leaves two overlapping spans in one layer while layers remain', () => {
    const spans = Array.from({ length: 40 }, (_, i) => S(`s${i}`, (i * 7) % 50, ((i * 7) % 50) + 6 + (i % 9)));
    const layers = assignLayers(spans);
    for (const a of spans) {
      for (const b of spans) {
        if (a.id < b.id && a.start < b.end && b.start < a.end) {
          const la = layers.get(a.id)!;
          const lb = layers.get(b.id)!;
          if (la < MAX_LAYERS - 1 && lb < MAX_LAYERS - 1) expect(la).not.toBe(lb);
        }
      }
    }
  });

  it('caps the depth: extra overlapping spans share the last layer', () => {
    const many = Array.from({ length: 8 }, (_, i) => S(`s${i}`, 0, 10));
    const layers = assignLayers(many, 3);
    expect(Math.max(...layers.values())).toBe(2);
  });
});
