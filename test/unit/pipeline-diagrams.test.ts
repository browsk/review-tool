import { afterAll, describe, expect, it } from 'vitest';
import { renderMarkdown } from '../../src/render/pipeline.js';
import { indicatorFor } from '../../src/render/diagnostics.js';
import { d2Service } from '../../src/diagrams/d2.js';
import type { DiagramRenderer } from '../../src/diagrams/types.js';

afterAll(() => d2Service.dispose());

const fake = (over: Partial<DiagramRenderer> = {}): Map<string, DiagramRenderer> =>
  new Map<string, DiagramRenderer>([
    ['mermaid', { lang: 'mermaid', title: 'Mermaid', kind: 'client', render: async () => ({}) }],
    [
      'fake',
      {
        lang: 'fake',
        title: 'Fake',
        kind: 'server',
        render: async (_s, theme) => ({ svg: `<svg data-theme="${theme}"><text>drawn</text></svg>` }),
        ...over,
      },
    ],
  ]);

const DOC = (body: string) => `# T\n\n## 1. One\n\nintro paragraph\n\n${body}\n\n## 2. Two\n\nafter\n`;

describe('diagram fences in the pipeline', () => {
  it('turns a mermaid fence into a client-rendered figure carrying its source, fence line and section', async () => {
    const md = DOC('```mermaid\ngraph TD\n  A --> B\n```');
    const r = await renderMarkdown(md, { renderers: fake() });
    const fence = md.split('\n').findIndex((l) => l.startsWith('```mermaid')) + 1;
    expect(r.html).toMatch(/<figure class="diagram diagram-mermaid"[^>]*data-diagram-lang="mermaid"/);
    expect(r.html).toContain(`data-fence-line="${fence}"`);
    expect(r.html).toContain('data-diagram-source="graph TD\n  A --&gt; B"');
    expect(r.html).toContain('<div class="diagram-client"></div>');
    expect(r.html).toMatch(/<figure[^>]*data-section-id="1"/);
    expect(r.html).not.toContain('<svg');
    expect(r.diagnostics).toEqual([]);
    expect(r.html).toContain('class="diagram-source"'); // the source is shown by the "Show source" toggle
    expect(r.html).toContain('A --'); // (highlighted markup still contains the text)
  });

  it('inlines light and dark SVG variants for server-rendered languages', async () => {
    const r = await renderMarkdown(DOC('```fake\nx\n```'), { renderers: fake() });
    expect(r.html).toContain('<div class="diagram-svg light"><svg data-theme="light">');
    expect(r.html).toContain('<div class="diagram-svg dark"><svg data-theme="dark">');
  });

  it('shows the source plus a notice, warns with the document line, and renders the rest of the document on failure', async () => {
    const md = DOC('```fake\nline one\nline two\n```');
    const renderers = fake({ render: async () => ({ error: { message: 'syntax error', line: 2 } }) });
    const r = await renderMarkdown(md, { renderers });
    const fence = md.split('\n').findIndex((l) => l.startsWith('```fake')) + 1;
    expect(r.html).toMatch(/<figure class="diagram diagram-fake failed"[^>]*data-diagram-status="failed"/);
    expect(r.html).toContain('<p class="diagram-notice" role="status">Diagram failed to render: syntax error</p>');
    expect(r.html).toContain('line one');
    expect(r.html).not.toContain('class="diagram-svg');
    expect(r.html).toContain('after'); // the rest of the document is unaffected
    expect(r.diagnostics).toEqual([expect.objectContaining({ severity: 'warning', code: 'diagram-failed', line: fence + 2, message: 'Fake diagram failed to render: syntax error' })]);
    expect(indicatorFor(r.diagnostics)).toBe('orange');
  });

  it('turns a throwing renderer into a failed diagram rather than failing the document', async () => {
    const r = await renderMarkdown(DOC('```fake\nx\n```'), { renderers: fake({ render: async () => { throw new Error('boom'); } }) });
    expect(r.failed).toBe(false);
    expect(r.html).toContain('Diagram failed to render: boom');
    expect(r.diagnostics[0]).toMatchObject({ code: 'diagram-failed' });
  });

  it('reports renderer warnings (e.g. TALA fallback) as diagnostics with their line', async () => {
    const md = DOC('```fake\na\nb\n```');
    const r = await renderMarkdown(md, { renderers: fake({ render: async (_s, t) => ({ svg: `<svg data-theme="${t}"/>`, warnings: [{ message: 'using dagre', line: 2 }] }) }) });
    const fence = md.split('\n').findIndex((l) => l.startsWith('```fake')) + 1;
    expect(r.diagnostics).toEqual([expect.objectContaining({ severity: 'warning', code: 'diagram-warning', line: fence + 2, message: 'Fake diagram: using dagre' })]);
    expect(r.html).toContain('diagram-svg light'); // still rendered
  });

  it('keeps several diagrams in order, in lists and block quotes, without mixing them up', async () => {
    const md = DOC('```fake\nfirst\n```\n\n> ```fake\n> second\n> ```\n\n- item\n\n  ```fake\n  third\n  ```');
    const r = await renderMarkdown(md, {
      renderers: fake({ render: async (s, t) => ({ svg: `<svg data-src="${s.replace(/\W/g, '')}-${t}"/>` }) }),
    });
    const order = [...r.html.matchAll(/data-src="(\w+)-light"/g)].map((m) => m[1]);
    expect(order).toEqual(['first', 'second', 'third']);
    expect(r.html.match(/<figure/g)).toHaveLength(3);
    expect(r.html).not.toContain('rt-diagram-'); // every marker was replaced
  });

  it('copes with sources containing HTML, quotes, ampersands and $-replacement patterns', async () => {
    const src = `a<b> "q" & 'single' $& $1 $\` $'`;
    const r = await renderMarkdown(DOC('```mermaid\n' + src + '\n```'), { renderers: fake() });
    expect(r.html).toContain('data-diagram-source="a&lt;b&gt; &quot;q&quot; &amp; &#39;single&#39; $&amp; $1 $` $&#39;"');
    expect(r.html).not.toContain('<b>');
  });

  it('leaves other code fences (and unregistered diagram languages) as ordinary highlighted code', async () => {
    const r = await renderMarkdown(DOC('```ts\nconst x = 1;\n```\n\n```plantuml\nA -> B\n```'), { renderers: fake() });
    expect(r.html).not.toContain('<figure');
    expect(r.html).toContain('shiki');
    expect(r.html).toContain('plantuml');
  });

  it('cannot be forged by raw HTML in the document: diagram markup and unsafe SVG are stripped', async () => {
    const md = DOC(
      '<figure class="diagram diagram-d2" data-diagram-lang="d2" data-diagram-source="x"><svg onload="alert(1)"><script>alert(2)</script><text>fake</text></svg></figure>\n\n' +
        '<div data-diagram-lang="mermaid" data-fence-line="1">x</div>\n\nrt-diagram-deadbeef-0',
    );
    const r = await renderMarkdown(md, { renderers: fake() });
    expect(r.html).not.toContain('data-diagram-lang');
    expect(r.html).not.toContain('data-diagram-source');
    expect(r.html).not.toMatch(/onload|<script|alert\(/);
    expect(r.html).toContain('rt-diagram-deadbeef-0'); // plain text that merely looks like a marker is left alone
  });

  it('a fence inside raw HTML or an unterminated fence does not break the document', async () => {
    const r = await renderMarkdown(DOC('```mermaid\ngraph TD\n  A --> B'), { renderers: fake() });
    expect(r.failed).toBe(false);
    expect(r.html).toContain('data-diagram-lang="mermaid"');
    expect(r.diagnostics.map((d) => d.code)).toContain('unclosed-fence');
  });
});

describe('with the real D2 renderer', () => {
  it('renders a valid D2 fence as sanitised light and dark SVG', async () => {
    const r = await renderMarkdown(DOC('```d2\nclient -> gateway: request\n```'));
    expect(r.diagnostics).toEqual([]);
    expect(r.html).toContain('<div class="diagram-svg light"><svg');
    expect(r.html).toContain('<div class="diagram-svg dark"><svg');
    expect(r.html).not.toMatch(/<script|onload|@import/);
    expect(r.html).toContain('data-diagram-lang="d2"');
  }, 30000);

  it('reports a D2 syntax error with the document line and keeps the source visible', async () => {
    const md = DOC('```d2\na -> b\nb -> c\nc -> ->\n```');
    const r = await renderMarkdown(md);
    const fence = md.split('\n').findIndex((l) => l.startsWith('```d2')) + 1;
    expect(r.html).toContain('diagram-d2 failed');
    expect(r.html).toContain('Diagram failed to render: connection missing destination');
    expect(r.diagnostics).toEqual([expect.objectContaining({ code: 'diagram-failed', severity: 'warning', line: fence + 3 })]);
    expect(indicatorFor(r.diagnostics)).toBe('orange');
  }, 30000);

  it('falls back from a requested TALA layout with a warning on the right line', async () => {
    const md = DOC('```d2\nvars: {\n  d2-config: {\n    layout-engine: tala\n  }\n}\nx -> y\n```');
    const r = await renderMarkdown(md);
    const fence = md.split('\n').findIndex((l) => l.startsWith('```d2')) + 1;
    expect(r.html).toContain('diagram-svg light');
    expect(r.diagnostics).toEqual([expect.objectContaining({ code: 'diagram-warning', line: fence + 3, message: expect.stringContaining('tala') })]);
  }, 30000);
});
