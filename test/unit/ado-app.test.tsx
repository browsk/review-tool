import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { loadConfig } from '../../src/server/config.js';
import { PAT, mockFetch } from '../fixtures/ado/mock.js';

const URL = (id: number) => `https://dev.azure.com/acme/Proj%20One/_git/platform/pullrequest/${id}`;
afterEach(() => vi.unstubAllGlobals());

function setup(env: Record<string, string> = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rt-adoapp-'));
  const config = { ...loadConfig([], env), port: 3999, dataDir };
  const { app, state } = createApp(config);
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal('fetch', mockFetch(calls));
  const H = { host: 'localhost:3999' };
  const post = (p: string, body: Record<string, string>) =>
    app.request(p, { method: 'POST', headers: { ...H, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ _token: state.token, ...body }).toString() });
  const loadPr = (id: number, extra: Record<string, string> = {}, pat: string | null = PAT) => post('/load/ado', { url: URL(id), ...(pat ? { pat } : {}), ...extra });
  return { app, state, post, loadPr, calls, dataDir, H };
}

function allFileText(dir: string): string {
  let out = '';
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out += allFileText(p);
    else out += fs.readFileSync(p).toString('latin1');
  }
  return out;
}

describe('POST /load/ado', () => {
  it('loads the single added markdown file, fetches its images, and warns about missing/unsafe ones', async () => {
    const { loadPr, state, calls } = setup();
    const res = await loadPr(101);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('Introduction and Goals');
    expect(html).toContain('data-state="orange"');
    expect(html).toContain('data-count="2"'); // images/missing.png and ../secret.png
    expect(html).toMatch(/<img[^>]*src="\/assets\/images\/diagram\.png"/);
    expect(state.doc?.sourceLabel).toContain('acme/Proj One/platform PR #101');
    expect(state.doc?.sessionId).toBeTruthy();
    // content came from the latest iteration's source commit
    expect(calls.filter((c) => c.url.includes('/items?')).every((c) => c.url.includes('c0ffee0000000000000000000000000000000002'))).toBe(true);
  });

  it('serves cached images through the scoped asset route and still refuses traversal', async () => {
    const { loadPr, app, H } = setup();
    await loadPr(101);
    const ok = await app.request('/assets/images/diagram.png', { headers: H });
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toBe('image/png');
    for (const p of ['/assets/..%2fsecret.png', '/assets/images/missing.png']) expect([403, 404]).toContain((await app.request(p, { headers: H })).status);
  });

  it('shows a picker when several markdown files were added, then loads the chosen one', async () => {
    const { loadPr, state } = setup();
    const res = await loadPr(102);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('id="ado-picker"');
    expect(html).toContain('/docs/a.md');
    expect(html).toContain('/docs/guides/b.MD');
    expect(html).not.toContain('/c.md'); // edited, not added
    expect(state.doc).toBeNull();
    const chosen = await loadPr(102, { file: '/docs/guides/b.MD' }, null); // the PAT is remembered in memory
    expect(await chosen.text()).toContain('Bravo text.');
    expect(state.doc?.name).toBe('b');
  });

  it('rejects a chosen file that the pull request did not add', async () => {
    const { loadPr } = setup();
    const res = await loadPr(102, { file: '/c.md' });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('not one of the markdown files added');
  });

  it('says so clearly when no markdown file was added, and keeps the previous document', async () => {
    const { loadPr, post, state } = setup();
    await post('/load/local', { path: path.resolve('test/fixtures/arc42-good.md') });
    const res = await loadPr(103);
    const html = await res.text();
    expect(res.status).toBe(422);
    expect(html).toContain('No new markdown (.md) files were added');
    expect(html).toContain('Introduction and Goals'); // the previous document stays displayed
    expect(state.doc?.name).toBe('arc42-good');
  });

  it('finds files on later pages of a paginated change list', async () => {
    const { loadPr } = setup();
    expect(await (await loadPr(107)).text()).toContain('Found on page two.');
  });

  it.each([
    ['wrong token', 101, 'wrong-token', 401, 'rejected the personal access token'],
    ['revoked token', 104, PAT, 401, 'rejected the personal access token'],
    ['sign-in page', 111, PAT, 401, 'rejected the personal access token'],
    ['no access', 105, PAT, 403, 'does not have access'],
    ['unknown PR', 999, PAT, 404, 'Pull request not found'],
    ['server error', 110, PAT, 502, 'HTTP 500'],
  ])('%s gives a specific user-facing message', async (_n, id, pat, status, text) => {
    const { loadPr } = setup();
    const res = await loadPr(id, {}, pat);
    const html = await res.text();
    expect(res.status).toBe(status);
    expect(html).toContain(text);
    expect(html).not.toContain(pat); // the token is never echoed
  });

  it('rejects malformed URLs, non-ADO hosts and a missing token without calling the network', async () => {
    const { post, calls } = setup();
    for (const url of ['', 'nonsense', 'https://example.com/acme/p/_git/r/pullrequest/1', 'http://dev.azure.com/acme/p/_git/r/pullrequest/1']) {
      const res = await post('/load/ado', { url, pat: PAT });
      expect(res.status).toBe(400);
      expect(await res.text()).toMatch(/Expected https:\/\/dev\.azure\.com|Please enter|not a valid URL|must start with https/);
    }
    const noPat = await post('/load/ado', { url: URL(101) });
    expect(noPat.status).toBe(401);
    expect(await noPat.text()).toContain('A personal access token is required');
    expect(calls).toHaveLength(0);
  });

  it('uses ADO_PAT from the environment when no token is entered', async () => {
    const { loadPr } = setup({ ADO_PAT: PAT });
    const res = await loadPr(101, {}, null);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Introduction and Goals');
  });

  it('does not keep a token that was just rejected', async () => {
    const { loadPr, state } = setup();
    expect((await loadPr(101, {}, 'wrong-token')).status).toBe(401);
    expect(state.adoPat).toBeUndefined();
    expect((await loadPr(101, {}, null)).status).toBe(401); // nothing remembered
  });

  it('shows a red read-failure state for a binary markdown file', async () => {
    const { loadPr, state } = setup();
    const html = await (await loadPr(108)).text();
    expect(html).toContain('data-state="red"');
    expect(state.doc?.sessionId).toBeNull();
  });

  it('never persists the token: not in the database, cache, recent list or CSV export', async () => {
    const { loadPr, dataDir, app, H, state, post } = setup();
    const secret = PAT;
    await loadPr(101);
    // give the session some feedback so the database and export have content
    const json = (method: string, url: string, body?: unknown) =>
      app.request(url, { method, headers: { ...H, 'content-type': 'application/json', 'x-review-token': state.token }, body: body ? JSON.stringify(body) : undefined });
    const p = (await (await json('POST', '/api/participants', { name: 'Ada' })).json()).participant;
    await json('POST', '/api/feedback', { scope: 'document', status: 'Accept', reviewerId: p.id });
    const csv = await (await app.request('/export.csv', { headers: H })).text();
    expect(csv).not.toContain(secret);
    expect(csv).toContain('arch'); // document_name
    await post('/load/ado', { url: URL(999), pat: secret });
    const everything = allFileText(dataDir);
    expect(everything).not.toContain(secret);
    expect(everything).not.toContain(Buffer.from(`:${secret}`).toString('base64'));
  });

  it('keeps reviews per pull-request file: feedback survives reloading the same PR file', async () => {
    const t = setup();
    await t.loadPr(101);
    const json = (method: string, url: string, body?: unknown) =>
      t.app.request(url, { method, headers: { ...t.H, 'content-type': 'application/json', 'x-review-token': t.state.token }, body: body ? JSON.stringify(body) : undefined });
    const p = (await (await json('POST', '/api/participants', { name: 'Ada' })).json()).participant;
    await json('POST', '/api/feedback', { scope: 'document', status: 'Accept', reviewerId: p.id });
    await t.loadPr(102, { file: '/docs/a.md' }); // a different document: separate session
    expect((await (await json('GET', '/api/state')).json()).feedback).toHaveLength(0);
    await t.loadPr(101, {}, null);
    expect((await (await json('GET', '/api/state')).json()).feedback).toHaveLength(1);
  });
});
