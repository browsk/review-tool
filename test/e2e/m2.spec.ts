import path from 'node:path';
import { test, expect } from './fixtures.js';
import type { Page } from '@playwright/test';

const fx = (n: string) => path.resolve('test/fixtures', n);

async function load(page: Page, file = 'arc42-long.md') {
  await page.goto('/');
  await page.fill('#path-input', fx(file));
  await page.click('form[action="/load/local"] >> text=Load');
  await expect(page.locator('#doc')).toBeVisible();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

const scrollY = (page: Page) => page.evaluate(() => window.scrollY);
const headerH = (page: Page) => page.evaluate(() => document.querySelector<HTMLElement>('.app-header')!.offsetHeight);
const topOf = (page: Page, text: string) =>
  page.evaluate((t) => {
    const h = Array.from(document.querySelectorAll<HTMLElement>('#doc h1,#doc h2,#doc h3')).find((x) => x.textContent?.trim() === t);
    return h ? Math.round(h.getBoundingClientRect().top) : null;
  }, text);

test.describe('keyboard navigation', () => {
  test('PageDown/PageUp scroll by one viewport minus overlap', async ({ page }) => {
    await load(page);
    const vh = await page.evaluate(() => window.innerHeight);
    const hh = await headerH(page);
    await page.keyboard.press('PageDown');
    expect(await scrollY(page)).toBe(vh - hh - 48);
    await page.keyboard.press('PageDown');
    expect(await scrollY(page)).toBe(2 * (vh - hh - 48));
    await page.keyboard.press('PageUp');
    expect(await scrollY(page)).toBe(vh - hh - 48);
  });

  test('Home and End go to the start and end of the document', async ({ page }) => {
    await load(page);
    await page.keyboard.press('End');
    const max = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    expect(Math.abs((await scrollY(page)) - max)).toBeLessThanOrEqual(1);
    await page.keyboard.press('Home');
    expect(await scrollY(page)).toBe(0);
  });

  for (const mod of ['Control', 'Alt']) {
    test(`${mod}+Down / ${mod}+Up move between headings of any level`, async ({ page }) => {
      await load(page);
      const hh = await headerH(page);
      const order = ['Long Sample Architecture', '1. Introduction and Goals', '1.1 Detail 1 of Introduction and Goals', '1.2 Detail 2 of Introduction and Goals', '2. Constraints'];
      // at the top the title has not yet been aligned to the header, so it is the first stop
      for (const t of order) {
        await page.keyboard.press(`${mod}+ArrowDown`);
        expect(Math.abs((await topOf(page, t))! - hh), t).toBeLessThanOrEqual(2);
      }
      for (const t of order.slice(0, -1).reverse()) {
        await page.keyboard.press(`${mod}+ArrowUp`);
        expect(Math.abs((await topOf(page, t))! - hh), t).toBeLessThanOrEqual(2);
      }
    });
  }

  test('Ctrl+Down keeps advancing through the last headings at the end of the page', async ({ page }) => {
    await load(page);
    const seen: string[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Control+ArrowDown');
      seen.push((await page.locator('#breadcrumb').getAttribute('data-current')) ?? '');
    }
    expect(seen).toContain('6.2 Detail 2 of Runtime View');
    expect(new Set(seen).size).toBeGreaterThan(10);
  });

  test('on-screen previous/next buttons navigate between headings', async ({ page }) => {
    await load(page);
    const hh = await headerH(page);
    await page.click('#next-section'); // title
    await page.click('#next-section');
    expect(Math.abs((await topOf(page, '1. Introduction and Goals'))! - hh)).toBeLessThanOrEqual(2);
    await page.click('#next-section');
    await page.click('#prev-section');
    expect(Math.abs((await topOf(page, '1. Introduction and Goals'))! - hh)).toBeLessThanOrEqual(2);
  });

  test('shortcuts do not fire while typing in an input', async ({ page }) => {
    await load(page);
    await page.focus('#path-input');
    for (const k of ['PageDown', 'End', 'Control+ArrowDown', 'Alt+ArrowDown']) {
      await page.keyboard.press(k);
      expect(await scrollY(page), k).toBe(0);
    }
  });

  test('scroll-driven breadcrumb shows the current section path', async ({ page }) => {
    await load(page);
    const hh = await headerH(page);
    await page.evaluate(() => document.querySelectorAll<HTMLElement>('#doc h3')[2]!.scrollIntoView({ block: 'start', behavior: 'instant' }));
    const crumb = page.locator('#breadcrumb');
    await expect(crumb).toContainText('Long Sample Architecture');
    await expect(crumb).toContainText('2. Constraints');
    await expect(crumb).toHaveAttribute('data-current', '2.1 Detail 1 of Constraints');
    expect(hh).toBeGreaterThan(0);
    // header stays visible (sticky) while scrolled
    const top = await page.locator('.app-header').evaluate((e) => e.getBoundingClientRect().top);
    expect(top).toBe(0);
  });
});

test.describe('zoom and presentation', () => {
  test('zoom scales the document text but not the header or panels, and persists', async ({ page }) => {
    await load(page);
    const size = (sel: string) => page.locator(sel).first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    const doc0 = await size('#doc p');
    const hdr0 = await size('.app-header');
    await page.click('#zoom-in');
    await page.click('#zoom-in');
    await expect(page.locator('#zoom-label')).toHaveText('120%');
    expect(await size('#doc p')).toBeCloseTo(doc0 * 1.2, 1);
    expect(await size('.app-header')).toBe(hdr0);
    await page.click('#diag-indicator');
    expect(await size('#diag-panel')).toBe(hdr0);

    await page.reload();
    await expect(page.locator('#zoom-label')).toHaveText('120%');
    expect(await size('#doc p')).toBeCloseTo(doc0 * 1.2, 1);
  });

  test('zoom is limited to 100%-200%', async ({ page }) => {
    await load(page);
    await expect(page.locator('#zoom-out')).toBeDisabled();
    for (let i = 0; i < 12; i++) if (await page.locator('#zoom-in').isEnabled()) await page.click('#zoom-in');
    await expect(page.locator('#zoom-label')).toHaveText('200%');
    await expect(page.locator('#zoom-in')).toBeDisabled();
  });

  test('document column has a comfortable reading width (70-80 characters) and is centred', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await load(page);
    const m = await page.evaluate(() => {
      const doc = document.getElementById('doc')!;
      const probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;visibility:hidden;width:1ch';
      doc.appendChild(probe);
      const ch = probe.getBoundingClientRect().width;
      probe.remove();
      const r = doc.getBoundingClientRect();
      return { chars: r.width / ch, left: r.left, right: window.innerWidth - r.right };
    });
    expect(m.chars).toBeGreaterThanOrEqual(70);
    expect(m.chars).toBeLessThanOrEqual(80);
    expect(Math.abs(m.left - m.right)).toBeLessThanOrEqual(20);
  });

  test('prefers-reduced-motion disables smooth scrolling and transitions', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await load(page);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('smooth');
  });

  test('the theme choice persists with the document view', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await load(page);
    await page.click('#theme-toggle');
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');
  });
});
