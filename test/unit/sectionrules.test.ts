// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { buildTextModel } from '../../src/shared/textmodel.js';
import { displayName, sectionAt, sectionsOf, validateSelection } from '../../src/shared/sectionrules.js';

const DOC = `
<h1 data-section-id="0">Title</h1>
<p data-section-id="0">Intro text</p>
<h2 data-section-id="1">1. One</h2>
<p data-section-id="1">aaa aaa</p>
<h3 data-section-id="1">1.1 Sub</h3>
<p data-section-id="1">bbb bbb</p>
<h2 data-section-id="2">2. Two</h2>
<p data-section-id="2">ccc ccc</p>`;

function setup() {
  document.body.innerHTML = `<article id="doc">${DOC}</article>`;
  const m = buildTextModel(document.getElementById('doc')!);
  return { m, sections: sectionsOf(m) };
}

describe('section model on the rendered text', () => {
  it('derives section intervals and headings', () => {
    const { m, sections } = setup();
    expect(sections.map((s) => [s.id, s.heading])).toEqual([['0', 'Title'], ['1', '1. One'], ['2', '2. Two']]);
    expect(sections[0]!.start).toBe(0);
    expect(sections[2]!.end).toBe(m.text.length);
    // intervals tile the whole text
    expect(sections[0]!.end).toBe(sections[1]!.start);
    expect(sections[1]!.end).toBe(sections[2]!.start);
  });
});

describe('validateSelection', () => {
  it('allows a selection that exactly covers one whole section (including its heading)', () => {
    const { m, sections } = setup();
    const s1 = sections[1]!;
    const lastChar = s1.end; // separator belongs to the section; selection ends right before next heading text
    expect(validateSelection(sections, s1.start, lastChar).ok).toBe(true);
    expect(validateSelection(sections, s1.start, m.text.indexOf('2. Two') - 1).ok).toBe(true);
  });

  it('rejects a selection that runs one character into the next section', () => {
    const { m, sections } = setup();
    const s1 = sections[1]!;
    const into = m.text.indexOf('2. Two') + 1;
    const r = validateSelection(sections, s1.start, into);
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === 'spans-sections') {
      expect(displayName(r.from)).toBe('1. One');
      expect(displayName(r.to)).toBe('2. Two');
    } else throw new Error('expected spans-sections');
  });

  it('allows a selection inside nested H3 content and across H3 boundaries of the same H2', () => {
    const { m, sections } = setup();
    const a = m.text.indexOf('aaa');
    const b = m.text.indexOf('bbb') + 3;
    expect(validateSelection(sections, a, b).ok).toBe(true);
    expect(validateSelection(sections, m.text.indexOf('1.1 Sub'), b).ok).toBe(true);
  });

  it('rejects a selection spanning the preamble and a section', () => {
    const { m, sections } = setup();
    const r = validateSelection(sections, m.text.indexOf('Intro'), m.text.indexOf('aaa') + 1);
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === 'spans-sections') expect(r.from.id).toBe('0');
  });

  it('treats empty ranges as invalid', () => {
    const { sections } = setup();
    expect(validateSelection(sections, 5, 5)).toEqual({ ok: false, reason: 'empty' });
  });

  it('sectionAt finds the owning section by binary search', () => {
    const { m, sections } = setup();
    expect(sectionAt(sections, m.text.indexOf('ccc'))!.id).toBe('2');
    expect(sectionAt(sections, 0)!.id).toBe('0');
  });
});
