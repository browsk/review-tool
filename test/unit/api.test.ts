import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { loadConfig } from '../../src/server/config.js';
import { openDb, nowIso } from '../../src/db/db.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rt-api-'));
afterAll(() => {
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* Windows keeps SQLite files locked until the process exits; the OS temp dir is cleaned later */
  }
});

let n = 0;
function setup(dataDir = fs.mkdtempSync(path.join(tmp, 'data-'))) {
  const config = { ...loadConfig([], {}), port: 3999, dataDir };
  const { app, state } = createApp(config);
  const H = { host: 'localhost:3999' };
  const json = (method: string, url: string, body?: unknown, extra: Record<string, string> = {}) =>
    app.request(url, {
      method,
      headers: { ...H, 'content-type': 'application/json', 'x-review-token': state.token, ...extra },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const docPath = path.join(fs.mkdtempSync(path.join(tmp, 'doc-')), `doc${n++}.md`);
  fs.writeFileSync(docPath, '# T\n\n## 1. A\n\nHello world.\n');
  const load = (p = docPath) =>
    app.request('/load/local', {
      method: 'POST',
      headers: { ...H, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ _token: state.token, path: p }).toString(),
    });
  return { app, state, json, load, docPath, dataDir, H };
}

const anchor = { start: 3, end: 8, quote: 'Hello', prefix: '', suffix: ' world.', sectionHeading: '1. A', kind: 'text' };

describe('feedback API', () => {
  it('requires a loaded document', async () => {
    const { json } = setup();
    expect((await json('GET', '/api/state')).status).toBe(409);
    expect((await json('POST', '/api/feedback', {})).status).toBe(409);
  });

  it('rejects requests without the token or JSON content type', async () => {
    const { app, load, H, state } = setup();
    await load();
    expect((await app.request('/api/state', { headers: H })).status).toBe(200); // GET needs no token
    const noToken = await app.request('/api/participants', { method: 'POST', headers: { ...H, 'content-type': 'application/json' }, body: '{"name":"A"}' });
    expect(noToken.status).toBe(403);
    const wrongType = await app.request('/api/participants', { method: 'POST', headers: { ...H, 'content-type': 'text/plain', 'x-review-token': state.token }, body: 'name=A' });
    expect(wrongType.status).toBe(415);
  });

  it('manages participants (add, duplicate, remove) with case-insensitive names', async () => {
    const { json, load } = setup();
    await load();
    const a = await json('POST', '/api/participants', { name: ' Ada ', role: 'author' });
    expect(a.status).toBe(201);
    expect((await json('POST', '/api/participants', { name: 'ada' })).status).toBe(409);
    expect((await json('POST', '/api/participants', { name: '' })).status).toBe(400);
    expect((await json('POST', '/api/participants', { name: 'X', role: 'boss' })).status).toBe(400);
    const id = (await a.json()).participant.id;
    const del = await json('DELETE', `/api/participants/${id}`);
    expect(del.status).toBe(200);
  });

  it('creates, reads, edits and deletes range and document feedback', async () => {
    const { json, load } = setup();
    await load();
    const p = (await (await json('POST', '/api/participants', { name: 'Ada' })).json()).participant;
    const created = await json('POST', '/api/feedback', { scope: 'range', status: 'Reject', comment: 'Too vague', reviewerId: p.id, anchor });
    expect(created.status).toBe(201);
    const fb = (await created.json()).feedback;
    expect(fb).toMatchObject({ scope: 'range', status: 'Reject', reviewerName: 'Ada', reviewerRole: 'reviewer', anchor: { start: 3, end: 8, quote: 'Hello' } });
    expect(fb.createdAt).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/);

    const doc = await json('POST', '/api/feedback', { scope: 'document', status: 'Accept', reviewerId: p.id });
    expect(doc.status).toBe(201);

    const patched = await json('PATCH', `/api/feedback/${fb.id}`, { status: 'Accept with conditions', comment: 'Add detail', reviewerId: p.id });
    expect((await patched.json()).feedback).toMatchObject({ status: 'Accept with conditions', comment: 'Add detail' });

    const state = await (await json('GET', '/api/state')).json();
    expect(state.feedback).toHaveLength(2);
    expect(state.session.lastReviewerId).toBe(p.id);

    expect((await json('DELETE', `/api/feedback/${fb.id}`)).status).toBe(200);
    expect((await json('DELETE', `/api/feedback/${fb.id}`)).status).toBe(404);
  });

  it('validates input: comment required for Reject and Accept with conditions, optional for Accept', async () => {
    const { json, load } = setup();
    await load();
    const p = (await (await json('POST', '/api/participants', { name: 'Ada' })).json()).participant;
    for (const status of ['Reject', 'Accept with conditions']) {
      const r = await json('POST', '/api/feedback', { scope: 'document', status, comment: '   ', reviewerId: p.id });
      expect(r.status).toBe(400);
      expect((await r.json()).errors.comment).toMatch(/required/);
    }
    expect((await json('POST', '/api/feedback', { scope: 'document', status: 'Accept', comment: '', reviewerId: p.id })).status).toBe(201);
    expect((await json('POST', '/api/feedback', { scope: 'document', status: 'Maybe', comment: 'x', reviewerId: p.id })).status).toBe(400);
    expect((await json('POST', '/api/feedback', { scope: 'document', status: 'Accept', reviewerId: 'nope' })).status).toBe(400);
    expect((await json('POST', '/api/feedback', { scope: 'range', status: 'Accept', reviewerId: p.id })).status).toBe(400); // no anchor
    expect((await json('POST', '/api/feedback', { scope: 'range', status: 'Accept', reviewerId: p.id, anchor: { ...anchor, end: 3 } })).status).toBe(400);
    expect((await json('POST', '/api/feedback', { scope: 'document', status: 'Accept', reviewerId: p.id, anchor })).status).toBe(400);
  });

  it('imports participants and reports file errors', async () => {
    const { json, load } = setup();
    await load();
    const ok = await json('POST', '/api/participants/import', { filename: 'p.csv', content: 'name,role\nAda,author\nBob,reviewer\n' });
    const body = await ok.json();
    expect(body.added).toEqual(['Ada', 'Bob']);
    expect(body.warnings).toEqual([]);
    const again = await (await json('POST', '/api/participants/import', { filename: 'p.csv', content: 'name\nada\nCy\n' })).json();
    expect(again.added).toEqual(['Cy']);
    expect(again.skipped).toEqual(['ada']);
    const bad = await json('POST', '/api/participants/import', { filename: 'p.csv', content: 'name,role\nX,boss\nY,author\ny,author\n' });
    expect(bad.status).toBe(400);
    expect((await bad.json()).errors.map((e: { row: number }) => e.row)).toEqual([2, 4]);
    const empty = await json('POST', '/api/participants/import', { filename: 'p.csv', content: '' });
    expect((await empty.json()).fatal).toMatch(/empty/);
  });

  it('blocks removing a participant who has feedback', async () => {
    const { json, load } = setup();
    await load();
    const p = (await (await json('POST', '/api/participants', { name: 'Ada' })).json()).participant;
    await json('POST', '/api/feedback', { scope: 'document', status: 'Accept', reviewerId: p.id });
    const r = await json('DELETE', `/api/participants/${p.id}`);
    expect(r.status).toBe(409);
  });
});

describe('sessions and persistence', () => {
  it('keeps feedback and participants across an app restart', async () => {
    const a = setup();
    await a.load();
    const p = (await (await a.json('POST', '/api/participants', { name: 'Ada', role: 'author' })).json()).participant;
    await a.json('POST', '/api/feedback', { scope: 'range', status: 'Reject', comment: 'c', reviewerId: p.id, anchor });
    // new app instance on the same data dir
    const b = setup(a.dataDir);
    await b.load(a.docPath);
    const st = await (await b.json('GET', '/api/state')).json();
    expect(st.participants).toHaveLength(1);
    expect(st.feedback).toHaveLength(1);
    expect(st.feedback[0].anchor.quote).toBe('Hello');
    expect(st.session.lastReviewerId).toBe(p.id);
  });

  it('resumes the session when the document changes, warns, and clears the warning after re-anchoring', async () => {
    const a = setup();
    await a.load();
    const p = (await (await a.json('POST', '/api/participants', { name: 'Ada' })).json()).participant;
    const fb = (await (await a.json('POST', '/api/feedback', { scope: 'range', status: 'Accept', reviewerId: p.id, anchor })).json()).feedback;
    fs.writeFileSync(a.docPath, '# T\n\nNew paragraph first.\n\n## 1. A\n\nHello world.\n');
    const html = await (await a.load()).text();
    expect(html).toContain('data-state="orange"');
    expect(html).toContain('changed since it was last reviewed');
    const st = await (await a.json('GET', '/api/state')).json();
    expect(st.feedback).toHaveLength(1); // resumed, not replaced
    expect(st.needsReanchor).toBe(true);
    const sha = st.session.sha256;
    const bad = await a.json('POST', '/api/session/reanchor', { sha256: 'wrong', updates: [] });
    expect(bad.status).toBe(409);
    const ok = await a.json('POST', '/api/session/reanchor', { sha256: sha, updates: [{ id: fb.id, start: 30, end: 35 }, { id: 'x', start: 'a', end: 2 }] });
    expect((await ok.json()).updated).toBe(1);
    const after = await (await a.json('GET', '/api/state')).json();
    expect(after.needsReanchor).toBe(false);
    expect(after.feedback[0].anchor).toMatchObject({ start: 30, end: 35 });
    // a reload of the unchanged document no longer warns
    const html2 = await (await a.load()).text();
    expect(html2).not.toContain('changed since it was last reviewed');
  });

  it('does not create a session for unreadable files', async () => {
    const { app, state, H } = setup();
    const res = await app.request('/load/local', {
      method: 'POST',
      headers: { ...H, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ _token: state.token, path: path.resolve('test/fixtures/binary.md') }).toString(),
    });
    expect(await res.text()).toContain('data-state="red"');
    expect(state.doc?.sessionId).toBeNull();
  });
});

describe('database', () => {
  it('migrates a fresh database, enforces constraints and refuses a newer schema', () => {
    const dir = fs.mkdtempSync(path.join(tmp, 'db-'));
    const db = openDb(dir);
    expect(db.pragma('user_version', { simple: true })).toBe(1);
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    db.prepare("INSERT INTO sessions(id, source_key, doc_name, content_sha256, created_at, updated_at) VALUES ('s','k','d','h','t','t')").run();
    db.prepare("INSERT INTO participants(id, session_id, name, role) VALUES ('p','s','Ada','reviewer')").run();
    // range feedback must have offsets with end > start
    expect(() =>
      db.prepare(
        "INSERT INTO feedback(id, session_id, scope, status, reviewer_id, created_at, created_epoch, updated_at, start_offset, end_offset, quote_exact) VALUES ('f','s','range','Accept','p','t',1,'t',5,5,'x')",
      ).run(),
    ).toThrow();
    // document feedback must not have offsets
    expect(() =>
      db.prepare(
        "INSERT INTO feedback(id, session_id, scope, status, reviewer_id, created_at, created_epoch, updated_at, start_offset, end_offset) VALUES ('g','s','document','Accept','p','t',1,'t',1,2)",
      ).run(),
    ).toThrow();
    db.pragma('user_version = 99');
    db.close();
    expect(() => openDb(dir)).toThrow(/newer/);
  });

  it('formats timestamps as ISO 8601 with an offset', () => {
    expect(nowIso(new Date(2026, 10, 18, 15, 47, 35))).toMatch(/^2026-11-18T15:47:35[+-]\d\d:\d\d$/);
  });
});
