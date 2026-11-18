import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from './fixtures.js';
import type { Page } from '@playwright/test';
import { addFeedbackViaDialog, openLoader, reload, seedParticipants, selectText } from './helpers.js';

const PAT = 'test-pat-123';
const MOCK = 'http://127.0.0.1:4174';
const prUrl = (id: number) => `https://dev.azure.com/acme/Proj%20One/_git/platform/pullrequest/${id}`;
const dataDir = () => process.env.RT_E2E_DATA_DIR!;

async function loadPr(page: Page, id: number | string, pat: string | null = PAT) {
  await page.goto('/');
  await openLoader(page);
  await page.fill('#ado-url', typeof id === 'number' ? prUrl(id) : id);
  if (pat !== null) await page.fill('#ado-pat', pat);
  await page.evaluate(() => ((window as any).__stale = true));
  await page.click('#ado-form button[type=submit]');
  await page.waitForFunction(() => !(window as any).__stale);
}

function allFileText(dir: string): string {
  let out = '';
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    out += e.isDirectory() ? allFileText(p) : fs.readFileSync(p).toString('latin1');
  }
  return out;
}

test.beforeEach(async ({ request }) => {
  await request.get(`${MOCK}/__reset`);
});

test.describe('Azure DevOps pull requests (mocked API)', () => {
  test('one added markdown file loads directly, with its images fetched and unsafe/missing ones flagged', async ({ page }) => {
    await loadPr(page, 101);
    await expect(page.locator('#doc h2').first()).toContainText('Introduction and Goals');
    await expect(page.locator('.doc-title')).toHaveText('arch');
    await expect(page.locator('.doc-title')).toHaveAttribute('title', /acme\/Proj One\/platform PR #101/);
    // the image added by the PR is fetched from the same commit and displayed
    const img = page.locator('#doc img[src="/assets/images/diagram.png"]');
    await expect(img).toHaveCount(1);
    expect(await img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
    // a missing image and one escaping the document directory become placeholders + warnings
    await expect(page.locator('.missing-image')).toHaveCount(2);
    await expect(page.locator('#diag-indicator')).toHaveAttribute('data-state', 'orange');
    await expect(page.locator('#diag-indicator')).toHaveAttribute('data-count', '2');
    await page.click('#diag-indicator');
    await expect(page.locator('#diag-panel')).toContainText('images/missing.png');
    await expect(page.locator('#diag-panel')).toContainText('../secret.png');
  });

  test('several added markdown files show a picker listing each path; choosing one loads it', async ({ page }) => {
    await loadPr(page, 102);
    const picker = page.locator('#ado-picker');
    await expect(picker).toBeVisible();
    await expect(picker.locator('li')).toHaveCount(2);
    await expect(picker).toContainText('/docs/a.md');
    await expect(picker).toContainText('/docs/guides/b.MD');
    await expect(picker).not.toContainText('/c.md'); // only ADDED files are offered
    await page.evaluate(() => ((window as any).__stale = true));
    await picker.getByRole('button', { name: '/docs/guides/b.MD' }).click();
    await page.waitForFunction(() => !(window as any).__stale);
    await expect(page.locator('#doc')).toContainText('Bravo text.');
    await expect(page.locator('.doc-title')).toHaveText('b');
  });

  test('a pull request that adds no markdown shows a clear message and keeps the previous document', async ({ page }) => {
    await loadPr(page, 101);
    await expect(page.locator('#doc')).toContainText('Introduction and Goals');
    await openLoader(page);
    await page.fill('#ado-url', prUrl(103));
    await page.evaluate(() => ((window as any).__stale = true));
    await page.click('#ado-form button[type=submit]');
    await page.waitForFunction(() => !(window as any).__stale);
    await expect(page.locator('#load-error')).toContainText('No new markdown (.md) files were added');
    await expect(page.locator('#doc')).toContainText('Introduction and Goals'); // previous document still shown
  });

  for (const [id, pat, text] of [
    [101, 'wrong-token', 'rejected the personal access token'],
    [104, PAT, 'rejected the personal access token'],
    [105, PAT, 'does not have access to this repository or pull request'],
    [999, PAT, 'Pull request not found'],
    [110, PAT, 'HTTP 500'],
  ] as const) {
    test(`HTTP error for PR ${id} (${text}) gives a specific message and never echoes the token`, async ({ page }) => {
      await loadPr(page, id, pat);
      await expect(page.locator('#load-error')).toContainText(text);
      expect(await page.content()).not.toContain(pat);
    });
  }

  test('malformed and non-Azure URLs are rejected before any request is made', async ({ page, request }) => {
    for (const bad of ['nonsense', 'https://example.com/acme/p/_git/r/pullrequest/1', 'https://dev.azure.com/acme/p/_git/r/pullrequest/abc']) {
      await loadPr(page, bad);
      await expect(page.locator('#load-error')).toContainText('https://dev.azure.com/{organisation}/{project}/_git/{repository}/pullrequest/{id}');
    }
    expect(await (await request.get(`${MOCK}/__requests`)).json()).toEqual([]);
    // (a missing token is covered by the unit tests: the server keeps an accepted token in memory between tests)
  });

  test('the legacy visualstudio.com URL form is accepted', async ({ page }) => {
    await loadPr(page, 'https://acme.visualstudio.com/Proj%20One/_git/platform/pullrequest/101');
    await expect(page.locator('#doc h2').first()).toContainText('Introduction and Goals');
  });

  test('every request used the token, and the token is never stored anywhere on disk', async ({ page, request }) => {
    await loadPr(page, 101);
    await seedParticipants(page, [{ name: 'Ada' }]);
    await selectText(page, 'The platform is described here.');
    await addFeedbackViaDialog(page, { reviewer: 'Ada', status: 'Reject', comment: 'x' });
    const reqs = (await (await request.get(`${MOCK}/__requests`)).json()) as { url: string; hasAuth: boolean }[];
    expect(reqs.length).toBeGreaterThan(4);
    expect(reqs.every((r) => r.hasAuth)).toBe(true);
    // all file requests used a commit (the latest iteration's), not a branch name
    expect(reqs.filter((r) => r.url.includes('/items?')).every((r) => r.url.includes('versionType=commit') && r.url.includes('c0ffee0000000000000000000000000000000002'))).toBe(true);
    const [dl] = await Promise.all([page.waitForEvent('download'), (async () => { await page.click('#btn-all-feedback'); await page.click('#export-link'); })()]);
    const exported = fs.readFileSync((await dl.path())!, 'utf8');
    expect(exported).not.toContain(PAT);
    expect(exported).toContain('arch'); // document_name
    const disk = allFileText(dataDir());
    expect(disk).not.toContain(PAT);
    expect(disk).not.toContain(Buffer.from(`:${PAT}`).toString('base64'));
  });

  test('feedback on a pull-request document works and persists across reloads', async ({ page }) => {
    await loadPr(page, 107); // its own document, so its review session is not shared with other tests
    await seedParticipants(page, [{ name: 'Ada' }]);
    await selectText(page, 'Found on page two.');
    await addFeedbackViaDialog(page, { reviewer: 'Ada', status: 'Accept with conditions', comment: 'document them' });
    await reload(page);
    await expect(page.locator('#all-count')).toHaveText('1');
    await page.click('#btn-all-feedback');
    await expect(page.locator('#side-panel .fb-card')).toContainText('document them');
  });
});
