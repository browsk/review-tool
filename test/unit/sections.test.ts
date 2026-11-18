import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../../src/render/pipeline.js';

const doc = `# Title

Intro

## 1. One

a

### 1.1 Sub

b

## 2. Two

c

# Late H1

d
`;

describe('section model', () => {
  it('extracts sections at level 2 with a preamble for content before the first section', async () => {
    const r = await renderMarkdown(doc);
    expect(r.sections.map((s) => [s.id, s.level, s.heading])).toEqual([
      [0, 0, ''],
      [1, 2, '1. One'],
      [2, 2, '2. Two'],
      [3, 1, 'Late H1'],
    ]);
  });

  it('keeps H3 subsections inside their parent H2 section', async () => {
    const r = await renderMarkdown(doc);
    const idOf = (re: RegExp) => re.exec(r.html)?.[1];
    expect(idOf(/<h3[^>]*data-section-id="(\d+)"/)).toBe('1');
    expect(idOf(/<h2[^>]*data-section-id="(\d+)"[^>]*>2\. Two/)).toBe('2');
  });

  it('stamps every top-level block with a section id', async () => {
    const r = await renderMarkdown(doc);
    const blocks = r.html.match(/<(h\d|p)[ >]/g)?.length ?? 0;
    const stamped = r.html.match(/<(h\d|p)[^>]*data-section-id=/g)?.length ?? 0;
    expect(stamped).toBe(blocks);
  });

  it('honours a configurable section level', async () => {
    const r = await renderMarkdown(doc, { sectionLevel: 3 });
    // shallower headings before the first level-3 section stay in the preamble;
    // shallower headings after it close it and open their own sections
    expect(r.sections.map((s) => s.heading)).toEqual(['', '1.1 Sub', '2. Two', 'Late H1']);
    const r1 = await renderMarkdown(doc, { sectionLevel: 1 });
    expect(r1.sections.map((s) => s.heading)).toEqual(['Title', 'Late H1']);
  });

  it('has no preamble when the document starts with a section heading', async () => {
    const r = await renderMarkdown('## A\n\nx\n\n## B\n\ny\n');
    expect(r.sections.map((s) => s.id)).toEqual([1, 2]);
  });

  it('handles documents with no headings', async () => {
    const r = await renderMarkdown('just text\n');
    expect(r.sections).toEqual([{ id: 0, level: 0, heading: '' }]);
  });
});
