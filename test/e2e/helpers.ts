import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect } from './fixtures.js';

const fixtures = path.resolve('test/fixtures');

/** Copy a fixture (and its images) to a unique temp dir so each test has its own review session. */
export function copyDoc(name: string, content?: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rt-doc-'));
  fs.cpSync(path.join(fixtures, 'images'), path.join(dir, 'images'), { recursive: true });
  const dest = path.join(dir, name);
  if (content !== undefined) fs.writeFileSync(dest, content);
  else fs.copyFileSync(path.join(fixtures, name), dest);
  return dest;
}

/** Submit the load form and wait for the NEW document (the start page may still show the previous one). */
export async function submitLoad(page: Page, file: string): Promise<void> {
  await page.fill('#path-input', file);
  await page.evaluate(() => ((window as any).__stale = true)); // a new document will not have this flag
  await page.click('form[action="/load/local"] >> text=Load');
  await page.waitForFunction(() => !(window as any).__stale);
}

export async function loadPath(page: Page, file: string): Promise<void> {
  await page.goto('/');
  await submitLoad(page, file);
  await expect(page.locator('#doc')).toBeVisible();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  if (await page.locator('#btn-participants').count()) await expect(page.locator('html')).toHaveAttribute('data-feedback-ready', '1');
}

export async function loadCopy(page: Page, name: string): Promise<string> {
  const file = copyDoc(name);
  await loadPath(page, file);
  return file;
}

export async function reload(page: Page): Promise<void> {
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-feedback-ready', '1');
}

/** Wait for two animation frames so rAF-scheduled UI updates (selection handling, layout) have run. */
export function settle(page: Page): Promise<void> {
  return page.evaluate(() => new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(() => res()))));
}

/** Create participants through the JSON API (fast path); the UI path is covered separately. */
export async function seedParticipants(page: Page, people: { name: string; role?: 'author' | 'reviewer' }[]): Promise<void> {
  const token = await page.locator('meta[name="review-token"]').getAttribute('content');
  for (const p of people) {
    const r = await page.request.post('/api/participants', { data: p, headers: { 'x-review-token': token! } });
    expect(r.ok()).toBe(true);
  }
  await reload(page);
}

/** Select text inside #doc programmatically (like a finished mouse selection) and fire mouseup. */
export async function selectText(page: Page, text: string, opts: { endText?: string; occurrence?: number } = {}): Promise<void> {
  await page.evaluate(
    ({ text, endText, occurrence }) => {
      const doc = document.getElementById('doc')!;
      const walker = document.createTreeWalker(doc, NodeFilter.SHOW_TEXT);
      const find = (needle: string, nth: number) => {
        let seen = 0;
        walker.currentNode = doc;
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          let from = 0;
          for (;;) {
            const i = (n as Text).data.indexOf(needle, from);
            if (i < 0) break;
            if (seen++ === nth) return { node: n as Text, index: i };
            from = i + 1;
          }
        }
        throw new Error(`text not found: ${needle}`);
      };
      const a = find(text, occurrence);
      const b = endText ? find(endText, 0) : a;
      const r = new Range();
      r.setStart(a.node, a.index);
      r.setEnd(b.node, b.index + (endText ?? text).length);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(r);
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    },
    { text, endText: opts.endText, occurrence: opts.occurrence ?? 0 },
  );
}

export async function addFeedbackViaDialog(
  page: Page,
  v: { reviewer?: string; status: 'Reject' | 'Accept with conditions' | 'Accept'; comment?: string },
): Promise<void> {
  await page.click('#sel-add');
  const dlg = page.locator('#fb-dialog');
  await expect(dlg).toBeVisible();
  if (v.reviewer) {
    const opts = await page.locator('#fb-reviewer option').allTextContents();
    const idx = opts.findIndex((o) => o.startsWith(`${v.reviewer} (`));
    expect(idx, `reviewer ${v.reviewer} in dialog`).toBeGreaterThanOrEqual(0);
    await page.selectOption('#fb-reviewer', { index: idx });
  }
  await dlg.getByLabel(v.status, { exact: true }).check();
  if (v.comment !== undefined) await page.fill('#fb-comment', v.comment);
  await page.click('#fb-save');
  await expect(dlg).toBeHidden();
}

/**
 * Registered highlights merged by status: "rt-reject-0", "rt-reject-1"... appear as "rt-reject"
 * (sizes summed, max priority, all range texts). "rt-flash" is reported as is; `layers` lists layer indexes used.
 */
export function highlightInfo(page: Page) {
  return page.evaluate(() => {
    const out: Record<string, { size: number; priority: number; text: string[]; layers: number[] }> = {};
    (CSS as any).highlights.forEach((h: any, name: string) => {
      const m = /^(rt-(?:reject|cond|accept))-(\d+)$/.exec(name);
      const key = m ? (m[1] as string) : name;
      const e = (out[key] ??= { size: 0, priority: 0, text: [], layers: [] });
      e.size += h.size;
      e.priority = Math.max(e.priority, h.priority);
      e.text.push(...Array.from(h as Iterable<Range>).map((r) => r.toString()));
      if (m) e.layers.push(Number(m[2]));
    });
    return out;
  });
}

/** Viewport coordinates of the middle of a text fragment inside #doc. */
export function pointOf(page: Page, text: string, occurrence = 0) {
  return page.evaluate(
    ({ text, occurrence }) => {
      const doc = document.getElementById('doc')!;
      const walker = document.createTreeWalker(doc, NodeFilter.SHOW_TEXT);
      let seen = 0;
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const i = (n as Text).data.indexOf(text);
        if (i >= 0 && seen++ === occurrence) {
          const r = new Range();
          r.setStart(n, i);
          r.setEnd(n, i + text.length);
          r.startContainer.parentElement!.scrollIntoView({ block: 'center', behavior: 'instant' });
          const b = r.getBoundingClientRect();
          return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
        }
      }
      throw new Error(`text not found: ${text}`);
    },
    { text, occurrence },
  );
}
