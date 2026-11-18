import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderMarkdown, looksBinary } from '../../src/render/pipeline.js';
import { indicatorFor } from '../../src/render/diagnostics.js';

const fx = (n: string) => fs.readFileSync(path.resolve('test/fixtures', n), 'utf8');
const exists = (rel: string) => fs.existsSync(path.resolve('test/fixtures', rel));

describe('markdown pipeline', () => {
  it('renders a good arc42 document with no diagnostics (green)', async () => {
    const r = await renderMarkdown(fx('arc42-good.md'), { assetExists: exists });
    expect(r.failed).toBe(false);
    expect(r.diagnostics).toEqual([]);
    expect(indicatorFor(r.diagnostics)).toBe('green');
    expect(r.html).toContain('<h2');
    expect(r.html).toContain('<table');
    expect(r.html).toContain('<del');
    expect(r.html).toContain('/assets/images/ok.png');
    expect(r.html).toMatch(/footnote/i);
  });

  it('hides front matter from the body and returns it separately', async () => {
    const r = await renderMarkdown(fx('arc42-good.md'), { assetExists: exists });
    expect(r.frontmatter).toContain('title: Sample System');
    expect(r.html).not.toContain('status: draft');
  });

  it('carries source offsets as data-src-start/end on blocks', async () => {
    const r = await renderMarkdown('# A\n\npara\n');
    expect(r.html).toMatch(/<h1[^>]*data-src-start="0"[^>]*data-src-end="3"/);
    expect(r.html).toMatch(/<p[^>]*data-src-start="5"/);
  });

  it('highlights fenced code with shiki markup that survives sanitising', async () => {
    const r = await renderMarkdown('```ts\nconst x = 1;\n```\n');
    expect(r.html).toContain('shiki');
    expect(r.html).toContain('--shiki-light');
  });

  it('warns (orange) for heading skip, unknown link, missing image, unclosed fence', async () => {
    const r = await renderMarkdown(fx('arc42-warnings.md'), { assetExists: exists });
    const codes = r.diagnostics.map((d) => d.code);
    expect(codes).toEqual(expect.arrayContaining(['heading-skip', 'unknown-link-target', 'missing-image', 'unclosed-fence']));
    expect(r.diagnostics.every((d) => d.severity === 'warning')).toBe(true);
    expect(indicatorFor(r.diagnostics)).toBe('orange');
    expect(r.html).toContain('missing-image');
    expect(r.html).toContain('images/nope.png');
    expect(r.diagnostics.find((d) => d.code === 'missing-image')?.line).toBe(7);
  });

  it('still renders content after an unclosed fence', async () => {
    const r = await renderMarkdown(fx('arc42-warnings.md'), { assetExists: exists });
    expect(r.html).toContain('const');
  });

  it('sanitises raw HTML', async () => {
    const r = await renderMarkdown(fx('xss.md'));
    expect(r.html).not.toMatch(/onerror|onclick|onload/i);
    expect(r.html).not.toContain('<script');
    expect(r.html).not.toContain('javascript:');
    expect(r.html).not.toContain('hx-get');
    expect(r.html).not.toContain('position:fixed');
    expect(r.html).not.toMatch(/\sid="user"/); // clobber-prefixed
  });

  it('never throws on pathological input and falls back per node/whole', async () => {
    const weird = ['', '\0\0', '#'.repeat(5000), '<'.repeat(2000), '```'.repeat(500), '| a |\n|--|\n'.repeat(200)];
    for (const w of weird) {
      const r = await renderMarkdown(w);
      expect(typeof r.html).toBe('string');
    }
  });

  it('detects binary input', () => {
    expect(looksBinary(Buffer.from([0, 1, 2]))).toBe(true);
    expect(looksBinary(Buffer.from([0xff, 0xfe, 0x41]))).toBe(true);
    expect(looksBinary(Buffer.from('héllo'))).toBe(false);
  });

  it('does not rewrite external images and flags them', async () => {
    const r = await renderMarkdown('![x](https://example.com/a.png)');
    expect(r.diagnostics.map((d) => d.code)).toContain('external-image');
    expect(r.html).not.toContain('<img');
    expect(r.html).not.toContain('src=');
    expect(r.html).toContain('External image not loaded');
  });
});
