// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { buildTextModel, offsetOf, quoteFor, rangeFor, DIAGRAM_PLACEHOLDER } from '../../src/shared/textmodel.js';

function model(html: string) {
  document.body.innerHTML = `<article id="doc">${html}</article>`;
  const root = document.getElementById('doc') as HTMLElement;
  return { root, m: buildTextModel(root) };
}

describe('text model: normalisation', () => {
  it('handles inline formatting, links and code spans', () => {
    const { m } = model('<p>Hello <b>big</b> <a href="#">world</a> and <code>x</code>.</p>');
    expect(m.text).toBe('Hello big world and x.');
  });

  it('separates list items and nested inline content', () => {
    const { m } = model('<ul><li>One</li><li>Two <em>2</em></li></ul>');
    expect(m.text).toBe('One\nTwo 2');
  });

  it('separates table cells by a space and rows by a newline', () => {
    const { m } = model('<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>');
    expect(m.text).toBe('A B\n1 2');
  });

  it('puts one newline between blocks and collapses whitespace', () => {
    const { m } = model('<h2>T</h2>\n<p>a\n   b</p>\n\n<p>  c  </p>');
    expect(m.text).toBe('T\na b\nc');
  });

  it('keeps <pre> verbatim and <br> as a newline', () => {
    const { m } = model('<pre><code>a  b\n c</code></pre><p>x<br>y</p>');
    expect(m.text).toBe('a  b\n c\nx\ny');
  });

  it('excludes data-no-anchor subtrees and script/style', () => {
    const { m } = model('<p>keep<span data-no-anchor>NOPE</span> this<script>x</script></p>');
    expect(m.text).toBe('keep this');
  });

  it('replaces a diagram block with one placeholder and ignores its inner text', () => {
    const { m } = model('<p>before</p><div data-diagram-lang="d2"><svg><text>HIDDEN</text></svg></div><p>after</p>');
    expect(m.text).toBe(`before\n${DIAGRAM_PLACEHOLDER}\nafter`);
    expect(m.diagrams).toHaveLength(1);
    expect(m.diagrams[0]).toMatchObject({ start: 7, end: 8 });
  });

  it('records the innermost text block for each chunk of text', () => {
    const { m } = model('<ul><li>One</li><li>Two</li></ul><table><tr><td>c</td></tr></table>');
    expect(m.blocks.map((b) => [b.el.tagName, m.text.slice(b.start, b.end)])).toEqual([
      ['LI', 'One'],
      ['LI', 'Two'],
      ['TD', 'c'],
    ]);
  });
});

describe('text model: offsets and ranges', () => {
  it('maps text-node points to offsets across inline formatting', () => {
    const { root, m } = model('<p>Hello <b>big</b> <a href="#">world</a>.</p>');
    const b = root.querySelector('b')!.firstChild!;
    const a = root.querySelector('a')!.firstChild!;
    expect(offsetOf(m, b, 0, 'start')).toBe(6);
    expect(offsetOf(m, b, 3, 'end')).toBe(9);
    expect(offsetOf(m, a, 0, 'start')).toBe(10);
    expect(m.text.slice(6, 15)).toBe('big world');
  });

  it('maps points across list items and table cells', () => {
    const { root, m } = model('<ul><li>One</li><li>Two</li></ul><table><tr><td>x1</td><td>y2</td></tr></table>');
    const li2 = root.querySelectorAll('li')[1]!.firstChild!;
    expect(offsetOf(m, li2, 1, 'start')).toBe(m.text.indexOf('Two') + 1);
    const td2 = root.querySelectorAll('td')[1]!.firstChild!;
    expect(offsetOf(m, td2, 0, 'start')).toBe(m.text.indexOf('y2'));
  });

  it('maps a selection across block boundaries within a section', () => {
    const { root, m } = model('<p>first para</p><p>second para</p>');
    const t1 = root.querySelectorAll('p')[0]!.firstChild!;
    const t2 = root.querySelectorAll('p')[1]!.firstChild!;
    const s = offsetOf(m, t1, 6, 'start')!;
    const e = offsetOf(m, t2, 6, 'end')!;
    expect(m.text.slice(s, e)).toBe('para\nsecond');
    expect(rangeFor(m, s, e)!.toString().replace(/\s+/g, ' ')).toBe('paraseconda'.slice(0, 0) + 'para' + 'second');
  });

  it('maps offsets inside collapsed whitespace runs to the right place', () => {
    const { root, m } = model('<p>a   b</p>');
    const t = root.querySelector('p')!.firstChild!;
    expect(m.text).toBe('a b');
    expect(offsetOf(m, t, 0, 'start')).toBe(0);
    expect(offsetOf(m, t, 1, 'start')).toBe(1); // before the run
    expect(offsetOf(m, t, 3, 'start')).toBe(2); // after the run
    expect(offsetOf(m, t, 4, 'start')).toBe(2); // directly before "b"
    expect(offsetOf(m, t, 5, 'end')).toBe(3);
  });

  it('maps element-boundary points (selection ending between blocks)', () => {
    const { root, m } = model('<p>one</p><p>two</p>');
    expect(offsetOf(m, root, 1, 'start')).toBe(m.text.indexOf('two'));
    expect(offsetOf(m, root, 2, 'end')).toBe(m.text.length);
  });

  it('snaps points inside a diagram to the placeholder', () => {
    const { root, m } = model('<p>x</p><div data-diagram-lang="mermaid"><svg><text>T</text></svg></div>');
    const inner = root.querySelector('text')!.firstChild!;
    expect(offsetOf(m, inner, 0, 'start')).toBe(2);
    expect(offsetOf(m, inner, 1, 'end')).toBe(3);
  });

  it('returns null for points in excluded chrome', () => {
    const { root, m } = model('<p>x<span data-no-anchor>UI</span></p>');
    expect(offsetOf(m, root.querySelector('span')!.firstChild!, 1, 'start')).toBeNull();
  });

  it('round-trips offsets through ranges for every text position', () => {
    const { m } = model(
      '<h2>Title</h2><p>Some <b>bold</b>  text, <a href="#">link</a>.</p><ul><li>a</li><li>b <i>c</i></li></ul><table><tr><td>1</td><td>2</td></tr></table><pre>x\n y</pre>',
    );
    for (let s = 0; s < m.text.length; s++) {
      for (let e = s + 1; e <= m.text.length; e += 3) {
        const r = rangeFor(m, s, e);
        if (!r) continue;
        const so = offsetOf(m, r.startContainer, r.startOffset, 'start');
        const eo = offsetOf(m, r.endContainer, r.endOffset, 'end');
        // synthetic separators (newline/space between blocks/cells) have no DOM point; the range snaps inward
        expect(m.text.slice(so!, eo!).trim()).toBe(m.text.slice(s, e).trim());
      }
    }
  });

  it('extracts quote and up to 32 characters of context either side', () => {
    const { m } = model('<p>' + 'a'.repeat(50) + 'QUOTE' + 'b'.repeat(50) + '</p>');
    const s = m.text.indexOf('QUOTE');
    const q = quoteFor(m, s, s + 5);
    expect(q.quote).toBe('QUOTE');
    expect(q.prefix).toBe('a'.repeat(32));
    expect(q.suffix).toBe('b'.repeat(32));
  });
});
