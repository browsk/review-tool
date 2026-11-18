/**
 * Performance check: a 2,000-line arc42-style document with 200 feedback items must render and highlight
 * in under 1 second. Run with `npm run test:perf` (tagged separately: timing depends on the machine).
 */
import { test, expect } from '@playwright/test';
import { copyDoc, loadPath, reload } from './helpers.js';

const SECTIONS = 36;
const STATUSES = ['Reject', 'Accept with conditions', 'Accept'] as const;

function bigDoc(): { text: string; lines: number } {
  const out: string[] = ['# Big Architecture', ''];
  for (let n = 1; n <= SECTIONS; n++) {
    out.push(`## ${n}. Section ${n}`, '');
    for (let s = 1; s <= 3; s++) {
      out.push(`### ${n}.${s} Subsection`, '');
      for (let p = 1; p <= 8; p++) {
        out.push(`Paragraph ${p} of section ${n}.${s}. Lorem ipsum dolor sit amet, **consectetur** adipiscing elit, sed do \`eiusmod\` tempor incididunt ut labore et dolore magna aliqua.`, '');
      }
    }
  }
  return { text: out.join('\n'), lines: out.length };
}

test('2,000-line document with 200 feedback items renders and highlights in under 1 second', async ({ page }) => {
  const { text, lines } = bigDoc();
  expect(lines).toBeGreaterThanOrEqual(2000);
  const file = copyDoc('big.md', text);
  await loadPath(page, file);
  const token = (await page.locator('meta[name="review-token"]').getAttribute('content'))!;
  const h = { 'x-review-token': token };
  const bob = (await (await page.request.post('/api/participants', { data: { name: 'Bob' }, headers: h })).json()).participant.id;

  for (let i = 0; i < 200; i++) {
    const n = (i % SECTIONS) + 1;
    const s = (i % 3) + 1;
    const p = (i % 8) + 1;
    const quote = i % 5 === 0 ? `Lorem ipsum dolor sit amet, consectetur` : `Paragraph ${p} of section ${n}.${s}.`;
    // deliberately stale offsets: the first load re-anchors every item by quote
    const anchor = {
      start: 0,
      end: quote.length,
      quote: i % 5 === 0 ? `Paragraph ${p} of section ${n}.${s}. Lorem ipsum dolor sit amet, consectetur` : quote,
      prefix: '',
      suffix: '',
      sectionHeading: `${n}. Section ${n}`,
      kind: 'text',
    };
    anchor.end = anchor.quote.length;
    const r = await page.request.post('/api/feedback', {
      data: { scope: 'range', status: STATUSES[i % 3], comment: `c${i}`, reviewerId: bob, anchor },
      headers: h,
    });
    expect(r.ok()).toBe(true);
  }

  await loadPath(page, file); // first load re-anchors and persists the new offsets
  await reload(page); // measured run: offsets are current

  const t = await page.evaluate(() => ({
    ready: performance.getEntriesByName('rt-feedback-ready')[0]!.startTime,
    init: performance.getEntriesByName('rt-feedback-init')[0]!.duration,
    highlights: (() => {
      let n = 0;
      (CSS as any).highlights.forEach((h: any) => (n += h.size));
      return n;
    })(),
    markers: document.querySelectorAll('.fb-marker').length,
  }));
  console.log(`perf: ${lines} lines, 200 items -> highlights=${t.highlights} markers=${t.markers} client-init=${t.init.toFixed(0)}ms ready-after-navigation=${t.ready.toFixed(0)}ms`);
  expect(t.highlights).toBe(200);
  expect(t.init).toBeLessThan(1000);
  expect(t.ready).toBeLessThan(1000);
});
