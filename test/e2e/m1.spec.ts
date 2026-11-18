import path from 'node:path';
import { test, expect } from './fixtures.js';

const fx = (n: string) => path.resolve('test/fixtures', n);

async function load(page: import('@playwright/test').Page, file: string) {
  await page.goto('/');
  await page.fill('#path-input', fx(file));
  await page.click('form[action="/load/local"] >> text=Load');
}

test('loads a valid document: renders and shows a green indicator', async ({ page }) => {
  await load(page, 'arc42-good.md');
  await expect(page.locator('#doc h2').first()).toContainText('Introduction and Goals');
  await expect(page.locator('#diag-indicator')).toHaveAttribute('data-state', 'green');
  await expect(page.locator('#doc img[src^="/assets/"]')).toHaveCount(1);
  expect(await page.locator('#doc img').evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
});

test('warnings give an orange indicator, a panel listing issues, and missing image placeholder', async ({ page }) => {
  await load(page, 'arc42-warnings.md');
  const ind = page.locator('#diag-indicator');
  await expect(ind).toHaveAttribute('data-state', 'orange');
  await expect(ind).toHaveAttribute('data-count', '4');
  await expect(page.locator('.missing-image')).toContainText('images/nope.png');
  await ind.click();
  await expect(page.locator('#diag-panel li')).toHaveCount(4);
  await expect(page.locator('#diag-panel')).toContainText('Image not found');
  await expect(page.locator('#doc')).toContainText('const a = 1;'); // content still shown
});

test('missing path shows an error and keeps the previous document', async ({ page }) => {
  await load(page, 'arc42-good.md');
  await page.fill('#path-input', fx('does-not-exist.md'));
  await page.click('form[action="/load/local"] >> text=Load');
  await expect(page.locator('#load-error')).toContainText('File not found');
  await expect(page.locator('#doc h2').first()).toContainText('Introduction and Goals');
});

test('binary and non-markdown files give a red indicator with a read failure entry', async ({ page }) => {
  for (const f of ['binary.md', 'notes.txt']) {
    await load(page, f);
    await expect(page.locator('#diag-indicator')).toHaveAttribute('data-state', 'red');
    await page.click('#diag-indicator');
    await expect(page.locator('#diag-panel li.sev-error')).toHaveCount(1);
  }
});

test('traversal image requests are not served', async ({ page, request }) => {
  await load(page, 'arc42-good.md');
  for (const p of ['/assets/..%2fsecret.txt', '/assets/%2e%2e/secret.txt', '/assets/secret.txt']) {
    const res = await request.get(p);
    expect([403, 404]).toContain(res.status());
    expect(await res.text()).not.toContain('SECRET');
  }
});

test('security headers are present', async ({ page }) => {
  const res = await page.goto('/');
  expect(res!.headers()['content-security-policy']).toContain("script-src 'self'");
});

for (const scheme of ['light', 'dark'] as const) {
  test(`follows OS ${scheme} preference and toggle persists across reload`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await load(page, 'arc42-good.md');
    const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(await bg()).toBe(scheme === 'dark' ? 'rgb(20, 22, 26)' : 'rgb(255, 255, 255)');
    await page.click('#theme-toggle');
    const flipped = scheme === 'dark' ? 'rgb(255, 255, 255)' : 'rgb(20, 22, 26)';
    expect(await bg()).toBe(flipped);
    await page.reload();
    expect(await bg()).toBe(flipped);
  });
}
