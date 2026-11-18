import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { test, expect } from './fixtures.js';
import type { Page } from '@playwright/test';
import { copyDoc, highlightInfo, loadCopy, loadPath, reload, seedParticipants, settle, submitLoad } from './helpers.js';

const PEOPLE = [{ name: 'Ada', role: 'author' as const }, { name: 'Bob' }];
const D2_1 = 'client -> gateway: request\ngateway -> ledger: persist';
const D2_2 = 'user -> app: clicks\napp -> db: query';
const MERMAID = 'graph TD\n  A[Client] --> B[Gateway]\n  B --> C[Ledger]';
const fixture = (n: string) => fs.readFileSync(path.resolve('test/fixtures', n), 'utf8');
const fenceLine = (md: string, lang: string, nth = 0) => md.split('\n').map((l, i) => [l, i + 1] as const).filter(([l]) => l.startsWith('```' + lang))[nth]![1];

const mermaidFig = (page: Page) => page.locator('figure[data-diagram-lang="mermaid"]');
const d2Fig = (page: Page, n = 0) => page.locator('figure[data-diagram-lang="d2"]').nth(n);

async function ready(page: Page) {
  await expect(page.locator('html')).toHaveAttribute('data-diagrams-ready', '1');
}
async function loadDiagrams(page: Page, name = 'diagrams.md') {
  const file = await loadCopy(page, name);
  await ready(page);
  return file;
}
async function panelLines(page: Page) {
  await page.click('#diag-indicator');
  return page.locator('#diag-panel li').evaluateAll((lis) => lis.map((li) => ({ line: li.querySelector('.line')?.textContent ?? '', msg: li.querySelector('.msg')?.textContent ?? '' })));
}
/** Hover a diagram and use its "Add feedback on this diagram" button. */
async function diagramFeedback(page: Page, fig: ReturnType<typeof d2Fig>, v: { reviewer: string; status: 'Reject' | 'Accept with conditions' | 'Accept'; comment?: string }) {
  await fig.scrollIntoViewIfNeeded();
  await fig.hover();
  await fig.locator('.dg-feedback').click();
  const dlg = page.locator('#fb-dialog');
  await expect(dlg).toBeVisible();
  const opts = await page.locator('#fb-reviewer option').allTextContents();
  await page.selectOption('#fb-reviewer', { index: opts.findIndex((o) => o.startsWith(`${v.reviewer} (`)) });
  await dlg.getByLabel(v.status, { exact: true }).check();
  if (v.comment !== undefined) await page.fill('#fb-comment', v.comment);
  await page.click('#fb-save');
  await expect(dlg).toBeHidden();
}

test.describe('rendering', () => {
  test('valid Mermaid and D2 diagrams render as SVG with a green indicator and no CSP violations', async ({ page }) => {
    const problems: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text());
    });
    page.on('pageerror', (e) => problems.push(String(e)));
    await loadDiagrams(page);
    await expect(mermaidFig(page).locator('.diagram-client svg')).toHaveCount(1);
    await expect(mermaidFig(page).locator('.diagram-client svg')).toContainText('Gateway');
    await expect(page.locator('figure[data-diagram-lang="d2"]')).toHaveCount(2);
    await expect(d2Fig(page).locator('.diagram-svg.light > svg')).toHaveCount(1);
    await expect(d2Fig(page).locator('.diagram-svg.dark > svg')).toHaveCount(1);
    await expect(d2Fig(page).locator('.diagram-svg.light')).toContainText('gateway');
    await expect(page.locator('#diag-indicator')).toHaveAttribute('data-state', 'green');
    await expect(page.locator('figure.diagram.failed')).toHaveCount(0);
    expect(problems.filter((p) => /Content Security Policy|violat|refused|Failed to load/i.test(p)), problems.join('\n')).toEqual([]);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`diagrams swap with the theme toggle (starting from the OS ${scheme} preference)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await loadDiagrams(page);
      const d2 = d2Fig(page);
      const shown = (which: 'light' | 'dark') => d2.locator(`.diagram-svg.${which}`).evaluate((e) => getComputedStyle(e).display !== 'none');
      expect(await shown(scheme)).toBe(true);
      expect(await shown(scheme === 'light' ? 'dark' : 'light')).toBe(false);
      const before = await mermaidFig(page).locator('.diagram-client svg').evaluate((e) => e.outerHTML);
      await page.click('#theme-toggle');
      const flipped = scheme === 'light' ? 'dark' : 'light';
      expect(await shown(flipped)).toBe(true);
      expect(await shown(scheme)).toBe(false);
      // Mermaid is re-rendered with the other theme
      await expect.poll(() => mermaidFig(page).locator('.diagram-client svg').evaluate((e) => e.outerHTML)).not.toBe(before);
      await expect(mermaidFig(page).locator('.diagram-client svg')).toHaveCount(1);
    });
  }

  test('"Show source" reveals the highlighted source of each diagram (hidden by default)', async ({ page }) => {
    await loadDiagrams(page);
    for (const [fig, text] of [[mermaidFig(page), 'graph TD'], [d2Fig(page), 'client -> gateway']] as const) {
      await expect(fig.locator('.diagram-source')).toBeHidden();
      await fig.locator('.dg-source').click();
      await expect(fig.locator('.diagram-source')).toBeVisible();
      await expect(fig.locator('.diagram-source')).toContainText(text);
      await expect(fig.locator('.dg-source')).toHaveText('Hide source');
      await fig.locator('.dg-source').click();
      await expect(fig.locator('.diagram-source')).toBeHidden();
    }
  });

  test('click-to-expand opens a large view and closes again', async ({ page }) => {
    await loadDiagrams(page);
    for (const fig of [mermaidFig(page), d2Fig(page)]) {
      await fig.locator('.dg-expand').click();
      const dlg = page.locator('#diagram-dialog');
      await expect(dlg).toBeVisible();
      await expect(dlg.locator('svg.expanded-svg')).toHaveCount(1);
      const wide = await dlg.locator('svg.expanded-svg').evaluate((e) => e.getBoundingClientRect().width);
      const small = await fig.locator('svg').first().evaluate((e) => e.getBoundingClientRect().width);
      expect(wide).toBeGreaterThan(small);
      await page.keyboard.press('Escape');
      await expect(dlg).toBeHidden();
    }
  });

  test('diagrams scale with the presentation zoom and never exceed the reading width', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await loadDiagrams(page);
    const svg = d2Fig(page).locator('.diagram-svg.light > svg');
    const width = () => svg.evaluate((e) => e.getBoundingClientRect().width);
    const w100 = await width();
    for (let i = 0; i < 4; i++) await page.click('#zoom-in'); // 140%
    await expect.poll(width).toBeGreaterThan(w100 * 1.3);
    const w140 = await width();
    expect(w140).toBeLessThanOrEqual(await d2Fig(page).evaluate((e) => (e as HTMLElement).clientWidth));
    expect(w100).toBeLessThanOrEqual(await d2Fig(page).evaluate((e) => (e as HTMLElement).clientWidth));
  });

  test('Mermaid is only downloaded for documents that contain a Mermaid diagram', async ({ page }) => {
    // bytes of code chunks downloaded (a few small shared chunks are loaded by every page; Mermaid itself is large)
    let chunkBytes = 0;
    page.on('response', async (r) => {
      if (r.url().includes('/static/chunks/')) chunkBytes += (await r.body().catch(() => Buffer.alloc(0))).length;
    });
    // (the start page re-displays the previously loaded document, so let that settle before measuring)
    const load = async (name: string) => {
      const file = copyDoc(name);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      chunkBytes = 0;
      await submitLoad(page, file);
      await ready(page);
      await page.waitForLoadState('networkidle');
    };
    await load('diagrams-tala.md'); // D2 only: the Mermaid library must not be fetched
    const withoutMermaid = chunkBytes;
    expect(withoutMermaid).toBeLessThan(100_000);
    await load('diagrams.md'); // contains a Mermaid diagram
    expect(chunkBytes).toBeGreaterThan(500_000);
    expect(chunkBytes).toBeGreaterThan(withoutMermaid * 10);
  });
});

test.describe('failures degrade gracefully', () => {
  test('invalid Mermaid and D2: source plus a notice, orange indicator with the error lines, the rest of the document unaffected', async ({ page }) => {
    const md = fixture('diagrams-invalid.md');
    await loadDiagrams(page, 'diagrams-invalid.md');
    const failed = page.locator('figure.diagram.failed');
    await expect(failed).toHaveCount(2);
    for (const fig of await failed.all()) {
      await expect(fig.locator('.diagram-notice')).toContainText('Diagram failed to render');
      await expect(fig.locator('.diagram-source')).toBeVisible(); // shown automatically
      await expect(fig.locator('svg').first()).toHaveCount(0);
    }
    await expect(d2Fig(page).locator('.diagram-source')).toContainText('c -> ->');
    await expect(mermaidFig(page).locator('.diagram-source')).toContainText('unterminated');
    await expect(page.locator('#doc')).toContainText('Paragraph after the diagrams is still shown.');
    await expect(page.locator('#doc')).toContainText('Paragraph before the broken diagrams.');

    await expect(page.locator('#diag-indicator')).toHaveAttribute('data-state', 'orange');
    await expect(page.locator('#diag-indicator')).toHaveAttribute('data-count', '2');
    const rows = await panelLines(page);
    const d2Row = rows.find((r) => r.msg.startsWith('D2 diagram failed'))!;
    expect(d2Row.line).toBe(`line ${fenceLine(md, 'd2') + 3}`); // "c -> ->" is the third line of the diagram
    const mRow = rows.find((r) => r.msg.startsWith('Mermaid diagram failed'))!;
    expect(mRow).toBeTruthy();
    const mLine = Number(/line (\d+)/.exec(mRow.line)![1]);
    expect(mLine).toBeGreaterThan(fenceLine(md, 'mermaid'));
    expect(mLine).toBeLessThanOrEqual(fenceLine(md, 'mermaid') + 4);
  });

  test('a TALA layout request renders with the fallback layout and a warning on the right line', async ({ page }) => {
    const md = fixture('diagrams-tala.md');
    await loadDiagrams(page, 'diagrams-tala.md');
    await expect(d2Fig(page).locator('.diagram-svg.light > svg')).toHaveCount(1);
    await expect(page.locator('figure.diagram.failed')).toHaveCount(0);
    await expect(page.locator('#diag-indicator')).toHaveAttribute('data-state', 'orange');
    const rows = await panelLines(page);
    expect(rows).toEqual([{ line: `line ${fenceLine(md, 'd2') + 3}`, msg: expect.stringMatching(/tala.*proprietary.*dagre/) }]);
  });
});

test.describe('feedback on diagrams', () => {
  test('hover button anchors feedback to the whole diagram: outline, margin marker, panel (D2 and Mermaid)', async ({ page }) => {
    await loadDiagrams(page);
    await seedParticipants(page, PEOPLE);
    await ready(page);
    const d2 = d2Fig(page);
    // the button is only offered on hover/focus
    await expect(d2.locator('.diagram-toolbar')).toHaveCSS('opacity', '0');
    await d2.hover();
    await expect(d2.locator('.diagram-toolbar')).toHaveCSS('opacity', '1');
    await expect(d2.locator('.dg-feedback')).toHaveText('Add feedback on this diagram');
    await d2.locator('.dg-feedback').click();
    await expect(page.locator('#fb-quote')).toHaveText(D2_1); // the quote is the diagram source
    await page.locator('#fb-dialog').getByLabel('Reject', { exact: true }).check();
    await page.fill('#fb-comment', 'Show the retry path');
    await page.click('#fb-save');
    await expect(d2).toHaveAttribute('data-fb', 'reject');
    await expect(d2).toHaveAttribute('data-fb-count', '1');
    expect(await d2.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe('solid');
    await expect(page.locator('.fb-marker')).toHaveCount(1);
    await expect(page.locator('.fb-marker .mk-count')).toHaveText('1');
    expect(Object.keys(await highlightInfo(page))).toEqual([]); // diagrams get an outline, not a text highlight

    await diagramFeedback(page, mermaidFig(page), { reviewer: 'Bob', status: 'Accept' });
    await expect(mermaidFig(page)).toHaveAttribute('data-fb', 'accept');
    await expect(page.locator('.fb-marker')).toHaveCount(2);

    // clicking an outlined diagram lists its feedback
    await d2.locator('.diagram-body').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('#side-panel .fb-card')).toHaveCount(1);
    await expect(page.locator('#side-panel .fb-card')).toContainText('Show the retry path');
    await expect(page.locator('#side-panel .fb-card')).toContainText('Reject');
    // the margin marker opens the same list
    await page.locator('.fb-marker').first().click();
    await expect(page.locator('#side-panel .fb-card')).toHaveCount(1);

    await reload(page);
    await ready(page);
    await expect(d2Fig(page)).toHaveAttribute('data-fb', 'reject');
    await expect(mermaidFig(page)).toHaveAttribute('data-fb', 'accept');
    // the highlights toggle hides outlines and markers
    await page.click('#btn-hl');
    await expect(d2Fig(page)).not.toHaveAttribute('data-fb', /.*/);
    await expect(page.locator('.fb-marker')).toHaveCount(0);
  });

  test('text selected inside a diagram snaps to the whole diagram block (and respects the one-section limit)', async ({ page }) => {
    await loadDiagrams(page);
    await seedParticipants(page, PEOPLE);
    await ready(page);
    const select = (from: string, fig: number) =>
      page.evaluate(
        ({ from, fig }) => {
          const doc = document.getElementById('doc')!;
          const w = document.createTreeWalker(doc, NodeFilter.SHOW_TEXT);
          let start: Text | null = null;
          for (let n = w.nextNode(); n; n = w.nextNode()) if ((n as Text).data.includes(from)) { start = n as Text; break; }
          const target = document.querySelectorAll('figure[data-diagram-lang="d2"]')[fig]!.querySelector('.diagram-svg.light text')!.firstChild!;
          const s = getSelection()!;
          s.setBaseAndExtent(start!, (start as Text).data.indexOf(from), target, 2);
          document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        },
        { from, fig },
      );

    // same section: allowed; the diagram counts as one block in the quote
    await select('Text between the diagrams.', 0);
    await settle(page);
    await expect(page.locator('#sel-add')).toBeVisible();
    await page.click('#sel-add');
    await expect(page.locator('#fb-quote')).toContainText('Text between the diagrams.');
    await expect(page.locator('#fb-quote')).toContainText('[diagram]');
    await page.click('#fb-cancel');

    // into a diagram of the NEXT section: rejected with a message naming both sections
    await select('Closing paragraph of section one.', 1);
    await settle(page);
    await expect(page.locator('#sel-add')).toBeHidden();
    await expect(page.locator('#sel-msg')).toContainText("'1. Context'");
    await expect(page.locator('#sel-msg')).toContainText("'2. Second Section'");
  });

  test('diagram feedback round-trips through CSV and re-anchors by source after the document changes', async ({ page }) => {
    const file = await loadDiagrams(page);
    await seedParticipants(page, PEOPLE);
    await ready(page);
    await diagramFeedback(page, d2Fig(page, 0), { reviewer: 'Ada', status: 'Accept with conditions', comment: 'first d2' });
    await diagramFeedback(page, d2Fig(page, 1), { reviewer: 'Bob', status: 'Reject', comment: 'second d2' });

    await page.click('#btn-all-feedback');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export-link')]);
    const csv = fs.readFileSync((await dl.path())!, 'utf8').replace(/^﻿/, '');
    const rows = parse(csv, { columns: true }) as Record<string, string>[];
    expect(rows).toHaveLength(2);
    const r1 = rows.find((r) => r.comment === 'first d2')!;
    expect(r1.scope).toBe('range');
    expect(r1.quote_exact).toBe(D2_1); // diagram source
    expect(Number(r1.end_offset) - Number(r1.start_offset)).toBe(1); // one placeholder character
    expect(r1.section_heading).toBe('1. Context');
    const csvPath = path.join(path.dirname(file), 'diagram-feedback.csv');
    fs.writeFileSync(csvPath, csv);

    // the document changes: text is inserted before the diagrams (offsets shift) and the second diagram is edited
    fs.writeFileSync(file, fixture('diagrams.md').replace('Intro paragraph before the diagrams.', 'Intro paragraph before the diagrams.\n\nA brand new paragraph that moves everything down.').replace('app -> db: query', 'app -> cache: lookup'));
    await loadPath(page, file);
    await ready(page);
    // delete what is there so the import is what brings it back
    await page.click('#btn-all-feedback');
    for (let n = await page.locator('#side-panel .fb-card').count(); n > 0; n--) {
      await page.locator('#side-panel .fb-card').first().getByRole('button', { name: 'Delete' }).click();
      await page.click('#confirm-yes');
    }
    await expect(page.locator('#all-count')).toHaveText('0');
    await page.setInputFiles('#import-file', csvPath);
    await expect(page.locator('#imp-hash-warning')).toContainText('different version of the document');
    await page.getByLabel(/Replace/).check();
    await page.click('#imp-go');
    await expect(page.locator('#imp-report')).toContainText('Imported 2 items');
    await expect(page.locator('#imp-report')).toContainText('1 imported item could not be located');
    await page.click('#imp-cancel');

    // the unchanged diagram moved but is found by its source; the edited one is listed as not located
    await expect(d2Fig(page, 0)).toHaveAttribute('data-fb', 'cond');
    await expect(page.locator('figure[data-fb]')).toHaveCount(1);
    await page.click('#btn-all-feedback');
    await expect(page.locator('#side-panel .fb-group').filter({ hasText: 'Could not locate' })).toContainText('second d2');
    expect(await page.locator('#side-panel .fb-quote').allTextContents()).toContain(D2_2); // its quote is the OLD source

    await reload(page); // kind was stored by the import, so a fresh page load still treats it as a diagram anchor
    await ready(page);
    await expect(d2Fig(page, 0)).toHaveAttribute('data-fb', 'cond');
  });
});
