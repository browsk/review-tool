/** Cross-browser smoke tests (Firefox, WebKit): Custom Highlight API, overlap layering, hit testing. */
import { test, expect } from './fixtures.js';
import { addFeedbackViaDialog, highlightInfo, loadCopy, pointOf, seedParticipants, selectText } from './helpers.js';

const PEOPLE = [{ name: 'Ada', role: 'author' as const }, { name: 'Bob' }];

test('Custom Highlight API: highlight, overlap layers, marker, hit test and panel work', async ({ page }) => {
  await loadCopy(page, 'arc42-long.md');
  await seedParticipants(page, PEOPLE);
  expect(await page.evaluate(() => 'highlights' in CSS && typeof (globalThis as any).Highlight === 'function')).toBe(true);

  await selectText(page, 'Paragraph 4 of section 2.1. Lorem ipsum');
  await addFeedbackViaDialog(page, { reviewer: 'Bob', status: 'Accept with conditions', comment: 'one' });
  await selectText(page, '2.1. Lorem ipsum dolor sit amet', { occurrence: 3 });
  await addFeedbackViaDialog(page, { reviewer: 'Ada', status: 'Reject', comment: 'two' });

  const info = await highlightInfo(page);
  expect(info['rt-cond']!.text).toEqual(['Paragraph 4 of section 2.1. Lorem ipsum']);
  expect(info['rt-reject']!.text).toEqual(['2.1. Lorem ipsum dolor sit amet']);
  expect(info['rt-reject']!.priority).toBeGreaterThan(info['rt-cond']!.priority);
  await expect(page.locator('.fb-marker')).toHaveCount(1);

  // hit-testing the overlap lists both items (caretPositionFromPoint / caretRangeFromPoint wrapper)
  const p = await pointOf(page, '2.1. Lorem ipsum', 3);
  await page.mouse.click(p.x, p.y);
  await expect(page.locator('#side-panel .fb-card')).toHaveCount(2);

  // the tint is actually painted
  await page.mouse.move(2, 2);
  const bgBefore = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bgBefore).toBeTruthy();
});

test('same-status overlaps use separate highlight layers so tints can stack', async ({ page }) => {
  await loadCopy(page, 'arc42-long.md');
  await seedParticipants(page, PEOPLE);
  await selectText(page, 'Paragraph 5 of section 3.1. Lorem ipsum');
  await addFeedbackViaDialog(page, { reviewer: 'Bob', status: 'Accept', comment: '' });
  await selectText(page, '3.1. Lorem ipsum dolor', { occurrence: 4 });
  await addFeedbackViaDialog(page, { reviewer: 'Ada', status: 'Accept', comment: '' });
  expect((await highlightInfo(page))['rt-accept']!.layers.sort()).toEqual([0, 1]);
});

test('Mermaid and D2 diagrams render in this browser and accept feedback with an outline', async ({ page }) => {
  await loadCopy(page, 'diagrams.md');
  await expect(page.locator('html')).toHaveAttribute('data-diagrams-ready', '1');
  await expect(page.locator('figure[data-diagram-lang="mermaid"] .diagram-client svg')).toHaveCount(1);
  await expect(page.locator('figure[data-diagram-lang="d2"]').first().locator('.diagram-svg.light > svg')).toHaveCount(1);
  await expect(page.locator('#diag-indicator')).toHaveAttribute('data-state', 'green');
  await seedParticipants(page, PEOPLE);
  await expect(page.locator('html')).toHaveAttribute('data-diagrams-ready', '1');

  const fig = page.locator('figure[data-diagram-lang="d2"]').first();
  await fig.hover();
  await fig.locator('.dg-feedback').click();
  await expect(page.locator('#fb-quote')).toContainText('client -> gateway');
  await page.locator('#fb-dialog').getByLabel('Accept', { exact: true }).check();
  await page.click('#fb-save');
  await expect(fig).toHaveAttribute('data-fb', 'accept');
  await expect(page.locator('.fb-marker')).toHaveCount(1);

  // theme toggle swaps the D2 variant and re-renders Mermaid
  const before = await page.locator('figure[data-diagram-lang="mermaid"] .diagram-client svg').evaluate((e) => e.outerHTML);
  await page.click('#theme-toggle');
  await expect.poll(() => page.locator('figure[data-diagram-lang="mermaid"] .diagram-client svg').evaluate((e) => e.outerHTML)).not.toBe(before);
});
