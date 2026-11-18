import path from 'node:path';
import os from 'node:os';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { loadConfig } from '../../src/server/config.js';

const fx = (n: string) => path.resolve('test/fixtures', n);

function setup() {
  const config = { ...loadConfig([], {}), port: 3999, dataDir: path.join(os.tmpdir(), 'rt-app-data') };
  const { app, state } = createApp(config);
  const H = { host: 'localhost:3999' };
  const post = (p: string, body: Record<string, string>, extra: Record<string, string> = {}) =>
    app.request(p, {
      method: 'POST',
      headers: { ...H, 'content-type': 'application/x-www-form-urlencoded', ...extra },
      body: new URLSearchParams({ _token: state.token, ...body }).toString(),
    });
  return { app, state, H, post };
}

describe('app', () => {
  it('serves the start page with security headers', async () => {
    const { app, H } = setup();
    const res = await app.request('/', { headers: H });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('rejects unknown Host headers', async () => {
    const { app } = setup();
    expect((await app.request('/', { headers: { host: 'evil.example.com' } })).status).toBe(403);
  });

  it('rejects POSTs without the token and cross-origin POSTs', async () => {
    const { app, H } = setup();
    const noToken = await app.request('/load/local', {
      method: 'POST',
      headers: { ...H, 'content-type': 'application/x-www-form-urlencoded' },
      body: 'path=x',
    });
    expect(noToken.status).toBe(403);
    const { post } = setup();
    expect((await post('/load/local', { path: fx('arc42-good.md') }, { origin: 'http://evil.example.com' })).status).toBe(403);
  });

  it('loads a valid document and shows a green indicator', async () => {
    const { post } = setup();
    const res = await post('/load/local', { path: fx('arc42-good.md') });
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('data-state="green"');
    expect(html).toContain('Introduction and Goals');
  });

  it('shows an orange indicator with issue count for warnings', async () => {
    const { post } = setup();
    const html = await (await post('/load/local', { path: fx('arc42-warnings.md') })).text();
    expect(html).toContain('data-state="orange"');
    expect(html).toContain('data-count="4"');
  });

  it('keeps the previous document when the path does not exist', async () => {
    const { post } = setup();
    await post('/load/local', { path: fx('arc42-good.md') });
    const res = await post('/load/local', { path: fx('missing.md') });
    const html = await res.text();
    expect(res.status).toBe(400);
    expect(html).toContain('File not found');
    expect(html).toContain('Introduction and Goals');
  });

  it('shows a red indicator for binary and non-markdown files', async () => {
    const { post } = setup();
    for (const f of ['binary.md', 'notes.txt']) {
      const html = await (await post('/load/local', { path: fx(f) })).text();
      expect(html).toContain('data-state="red"');
      expect(html).toContain('data-count="1"');
    }
  });

  it('serves images from the document directory and refuses traversal', async () => {
    const { app, post, H } = setup();
    await post('/load/local', { path: fx('arc42-good.md') });
    const ok = await app.request('/assets/images/ok.png', { headers: H });
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toBe('image/png');
    for (const p of ['/assets/../../etc/passwd', '/assets/..%2f..%2fetc%2fpasswd', '/assets/%2e%2e/secret.txt', '/assets/secret.txt']) {
      const r = await app.request(p, { headers: H });
      expect([403, 404]).toContain(r.status);
      expect(await r.text()).not.toContain('SECRET');
    }
    expect((await app.request('/assets/..%2fsecret.txt', { headers: H })).status).toBe(403);
  });
});
