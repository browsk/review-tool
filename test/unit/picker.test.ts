import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { loadConfig } from '../../src/server/config.js';
import type { PickResult } from '../../src/sources/picker.js';

function setup(result: PickResult) {
  const config = { ...loadConfig([], {}), port: 3998, dataDir: path.join(os.tmpdir(), 'rt-pick-data') };
  const { app, state } = createApp(config, { pickFile: async () => result });
  const post = (token: string | null) =>
    app.request('/api/pick-file', { method: 'POST', headers: { host: 'localhost:3998', 'content-type': 'application/json', ...(token ? { 'x-review-token': token } : {}) } });
  return { state, post };
}

describe('file dialog route', () => {
  it('returns the chosen path, or null when cancelled', async () => {
    const a = setup({ path: 'C:\\docs\\a.md' });
    expect(await (await a.post(a.state.token)).json()).toEqual({ path: 'C:\\docs\\a.md' });
    const b = setup({ path: null });
    expect(await (await b.post(b.state.token)).json()).toEqual({ path: null });
  });
  it('reports an unavailable dialog and requires the token', async () => {
    const a = setup({ error: 'no dialog' });
    const r = await a.post(a.state.token);
    expect(r.status).toBe(501);
    expect(await r.json()).toEqual({ error: 'no dialog' });
    expect((await a.post(null)).status).toBe(403);
    expect((await a.post('wrong')).status).toBe(403);
  });
});

