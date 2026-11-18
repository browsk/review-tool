import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DARK, LIGHT, contrast, hex, stack, type StatusKey } from '../../src/shared/palette.js';

const css = fs.readFileSync('public/styles.css', 'utf8');

describe.each([['light', LIGHT], ['dark', DARK]] as const)('%s highlight palette', (_name, pal) => {
  const bg = hex(pal.bg);
  const fg = hex(pal.fg);
  for (const k of ['reject', 'cond', 'accept'] as StatusKey[]) {
    it(`${k}: body text keeps WCAG AA (4.5:1) under up to 5 stacked highlights`, () => {
      for (let n = 1; n <= 5; n++) {
        expect(contrast(fg, stack(bg, pal.layers[k], n)), `${n} layers`).toBeGreaterThanOrEqual(4.5);
      }
    });
    it(`${k}: underline colour has 3:1 contrast against the background`, () => {
      expect(contrast(hex(pal.layers[k].line), bg)).toBeGreaterThanOrEqual(3);
    });
  }
});

describe('styles.css uses the palette values', () => {
  it('declares every tint and underline colour from the palette', () => {
    for (const pal of [LIGHT, DARK]) {
      for (const k of ['reject', 'cond', 'accept'] as StatusKey[]) {
        const l = pal.layers[k];
        expect(css).toContain(`rgba(${l.tint.join(', ')}, ${l.alpha})`);
        expect(css.toLowerCase()).toContain(l.line.toLowerCase());
      }
    }
  });
});
