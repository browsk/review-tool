import fs from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { renderMarkdown } from '../../src/render/pipeline.js';
import { parseParticipants } from '../../src/feedback/participants.js';
import { d2Service } from '../../src/diagrams/d2.js';
import { authorWarning } from '../../src/feedback/model.js';

afterAll(() => d2Service.dispose());

describe('shipped examples', () => {
  const assetExists = (rel: string) => fs.existsSync(`examples/${rel}`);

  it('the sample arc42 document renders with no warnings and includes Mermaid and D2 diagrams', async () => {
    const r = await renderMarkdown(fs.readFileSync('examples/arc42-sample.md', 'utf8'), { assetExists });
    expect(r.failed).toBe(false);
    expect(r.diagnostics).toEqual([]);
    expect(r.html).toMatch(/data-diagram-lang="mermaid"/);
    expect(r.html).toMatch(/data-diagram-lang="d2"/);
    expect(r.html.match(/<figure/g)!.length).toBeGreaterThanOrEqual(2);
    expect(r.html).not.toContain('diagram failed');
    expect(r.html).toContain('/assets/images/overview.svg');
    expect(r.frontmatter).toContain('title: Payments Platform Architecture');
    expect(r.sections.filter((s) => s.level === 2)).toHaveLength(12); // arc42's twelve sections
  }, 60000);

  it('the large sample document renders with no warnings', async () => {
    const r = await renderMarkdown(fs.readFileSync('examples/arc42-large.md', 'utf8'));
    expect(r.diagnostics).toEqual([]);
    expect(r.sections.length).toBeGreaterThan(10);
  });

  it.each(['participants.csv', 'participants.json'])('%s is a valid participant file with exactly one author', (f) => {
    const r = parseParticipants(f, fs.readFileSync(`examples/${f}`, 'utf8'));
    expect(r.fatal).toBeUndefined();
    expect(r.errors).toEqual([]);
    expect(r.participants.map((p) => p.name)).toEqual(['Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Margaret Hamilton']);
    expect(authorWarning(r.participants.filter((p) => p.role === 'author').length)).toBeNull();
  });
});
