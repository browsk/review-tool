// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { actionFor, breadcrumbFor, clampZoom, isTypingTarget, pickHeading, type KeyLike } from '../../client/navlogic.js';

const key = (k: string, mods: Partial<KeyLike> = {}): KeyLike => ({
  key: k, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, ...mods,
});
const el = (html: string) => {
  document.body.innerHTML = html;
  return document.body.firstElementChild as HTMLElement;
};

describe('actionFor', () => {
  it('maps navigation keys', () => {
    const body = document.body;
    expect(actionFor(key('PageDown'), body)).toBe('page-down');
    expect(actionFor(key('PageUp'), body)).toBe('page-up');
    expect(actionFor(key('Home'), body)).toBe('home');
    expect(actionFor(key('End'), body)).toBe('end');
    expect(actionFor(key('ArrowDown', { ctrlKey: true }), body)).toBe('next-section');
    expect(actionFor(key('ArrowUp', { ctrlKey: true }), body)).toBe('prev-section');
    expect(actionFor(key('ArrowDown', { altKey: true }), body)).toBe('next-section');
    expect(actionFor(key('ArrowUp', { altKey: true }), body)).toBe('prev-section');
  });

  it('ignores plain arrows, other keys, shift/meta combos and ctrl+alt', () => {
    const body = document.body;
    expect(actionFor(key('ArrowDown'), body)).toBeNull();
    expect(actionFor(key('a'), body)).toBeNull();
    expect(actionFor(key('PageDown', { shiftKey: true }), body)).toBeNull();
    expect(actionFor(key('ArrowDown', { metaKey: true }), body)).toBeNull();
    expect(actionFor(key('ArrowDown', { ctrlKey: true, altKey: true }), body)).toBeNull();
    expect(actionFor({ ...key('PageDown'), defaultPrevented: true }, body)).toBeNull();
  });

  it.each([
    '<input type="text">',
    '<textarea></textarea>',
    '<select><option>a</option></select>',
    '<div contenteditable="true">x</div>',
    '<div role="textbox">x</div>',
  ])('does not fire while focus is in %s', (html) => {
    const t = el(html);
    expect(isTypingTarget(t)).toBe(true);
    for (const k of ['PageDown', 'PageUp', 'Home', 'End']) expect(actionFor(key(k), t)).toBeNull();
    expect(actionFor(key('ArrowDown', { ctrlKey: true }), t)).toBeNull();
    expect(actionFor(key('ArrowUp', { altKey: true }), t)).toBeNull();
  });

  it('still fires for non-typing elements', () => {
    expect(isTypingTarget(el('<button>x</button>'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('pickHeading', () => {
  const tops = [-500, -100, 300, 900]; // viewport-relative; header bottom at 48
  it('next picks the first heading below the header', () => {
    expect(pickHeading(tops, 48, 1)).toBe(2);
  });
  it('prev picks the last heading above the header', () => {
    expect(pickHeading(tops, 48, -1)).toBe(1);
  });
  it('a heading already aligned at the header counts as current', () => {
    const aligned = [-300, 48, 600];
    expect(pickHeading(aligned, 48, 1)).toBe(2);
    expect(pickHeading(aligned, 48, -1)).toBe(0);
  });
  it('returns -1 before the first and length after the last', () => {
    expect(pickHeading([200, 800], 48, -1)).toBe(-1);
    expect(pickHeading([-200, -100], 48, 1)).toBe(2);
  });
  it('does not get stuck when the end of the page stops headings aligning', () => {
    // last jump went to index 1 but could not align; heading 2 still looks "after" and heading 1 too
    const t = [-400, 200, 500];
    expect(pickHeading(t, 48, 1, { index: 1, stable: true })).toBe(2);
    expect(pickHeading(t, 48, 1, { index: 1, stable: false })).toBe(1);
  });
});

describe('breadcrumbFor', () => {
  const hs = [
    { level: 1, text: 'Title' },
    { level: 2, text: '1. A' },
    { level: 3, text: '1.1 A-a' },
    { level: 3, text: '1.2 A-b' },
    { level: 2, text: '2. B' },
  ];
  it('builds the ancestor path', () => {
    expect(breadcrumbFor(hs, 3).map((c) => c.text)).toEqual(['Title', '1. A', '1.2 A-b']);
    expect(breadcrumbFor(hs, 4).map((c) => c.text)).toEqual(['Title', '2. B']);
    expect(breadcrumbFor(hs, -1)).toEqual([]);
  });
});

describe('clampZoom', () => {
  it('clamps to 100-200 in steps of 10', () => {
    expect(clampZoom(50)).toBe(100);
    expect(clampZoom(250)).toBe(200);
    expect(clampZoom(133)).toBe(130);
    expect(clampZoom(NaN)).toBe(100);
  });
});
