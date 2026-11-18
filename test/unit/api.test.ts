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
    expect(fb.createdAt).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}[+-]\d\d:\d\d$/);

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

describe('participant roles', () => {
  it('changes a role in place and returns the friendly author warning', async () => {
    const { json, load } = setup();
    await load();
    const p = (await (await json('POST', '/api/participants', { name: 'Ada' })).json()).participant;
    const r = await json('PATCH', `/api/participants/${p.id}`, { role: 'author' });
    const body = await r.json();
    expect(body.participants[0].role).toBe('author');
    expect(body.warnings).toEqual([]);
    const two = (await (await json('POST', '/api/participants', { name: 'Bob', role: 'author' })).json()).participant;
    const again = await (await json('PATCH', `/api/participants/${two.id}`, { role: 'author' })).json();
    expect(again.warnings[0]).toMatch(/Several authors are set \(2\)/);
    const none = await (await json('PATCH', `/api/participants/${p.id}`, { role: 'reviewer' })).json();
    const none2 = await (await json('PATCH', `/api/participants/${two.id}`, { role: 'reviewer' })).json();
    expect(none.warnings.length + none2.warnings.length).toBeGreaterThan(0);
    expect(none2.warnings[0]).toMatch(/No author is set/);
    expect((await json('PATCH', `/api/participants/${p.id}`, { role: 'boss' })).status).toBe(400);
    expect((await json('PATCH', '/api/participants/nope', { role: 'author' })).status).toBe(404);
  });
});

describe('CSV export and import API', () => {
  async function seeded() {
    const t = setup();
    await t.load();
    const ada = (await (await t.json('POST', '/api/participants', { name: 'Ada', role: 'author' })).json()).participant;
    const mk = async (b: object) => (await (await t.json('POST', '/api/feedback', { reviewerId: ada.id, ...b })).json()).feedback;
    const r1 = await mk({ scope: 'range', status: 'Reject', comment: '=evil, "quoted"\nsecond line', anchor });
    const r2 = await mk({ scope: 'document', status: 'Accept' });
    const exp = async () => {
      const res = await t.app.request('/export.csv', { headers: t.H });
      const bytes = new Uint8Array(await res.clone().arrayBuffer()); // text() would strip the BOM
      return { res, text: await res.text(), bytes };
    };
    const preview = async (content: string) => (await t.json('POST', '/api/import/preview', { content })).json();
    const commit = async (token: string | null, mode: string) => t.json('POST', '/api/import/commit', { token, mode });
    const state = async () => (await t.json('GET', '/api/state')).json();
    return { ...t, ada, r1, r2, exp, preview, commit, state };
  }

  it('exports a downloadable CSV with a BOM, the right filename and every item', async () => {
    const { exp } = await seeded();
    const { res, text, bytes } = await exp();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toMatch(/^attachment; filename="doc\d+-feedback-\d{8}-\d{4}\.csv"/);
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM
    expect(text.split('\r\n')[0]).toContain('id,document_name,document_sha256,scope,status,reviewer,reviewer_role,created_at');
    expect(text).toContain("'=evil"); // injection guard
    expect((await (await setup().app.request('/export.csv', { headers: setup().H })).text())).toMatch(/No document loaded/);
  });

  it('previews counts, duplicates, new reviewers and invalid rows without changing anything', async () => {
    const { exp, preview, state, r1 } = await seeded();
    const { text } = await exp();
    const edited = text.replace(/Ada/g, 'Zed').replace(r1.id, '11111111-1111-4111-8111-111111111111') + '\r\nbad-row,range\r\n';
    const p = await preview(edited);
    expect(p).toMatchObject({ totalRows: 3, validRows: 2, existingCount: 2, duplicates: 1, hashMismatch: false }) // r2 keeps its id, r1 was re-id'd;
    expect(p.byScope).toEqual({ document: 1, range: 1 });
    expect(p.byStatus).toEqual({ Reject: 1, 'Accept with conditions': 0, Accept: 1 });
    expect(p.newReviewers).toEqual(['Zed']);
    expect(p.errors).toHaveLength(1);
    expect((await state()).feedback).toHaveLength(2); // preview changes nothing
  });

  it('warns when document_sha256 does not match the loaded document', async () => {
    const { exp, preview } = await seeded();
    const { text } = await exp();
    expect((await preview(text)).hashMismatch).toBe(false);
    expect((await preview(text.replace(/[0-9a-f]{64}/g, 'f'.repeat(64)))).hashMismatch).toBe(true);
  });

  it('Replace: writes a backup of the old feedback first, then swaps in the imported items', async () => {
    const t = await seeded();
    const { text } = await t.exp();
    const other = text.replace(/Ada/g, 'Ada').split('\r\n');
    // an import file with one fresh item
    const header = other[0]!;
    const row = `22222222-2222-4222-8222-222222222222,doc,${'0'.repeat(64)},document,Accept with conditions,Ada,author,2026-11-18T10:00:00+10:00,2026-11-18T10:00:00+10:00,needs work,,,,,,`;
    const p = await t.preview(`${header}\r\n${row}\r\n`);
    const r = await (await t.commit(p.token, 'replace')).json();
    expect(r).toMatchObject({ mode: 'replace', imported: 1, duplicates: [], conflicts: [], addedReviewers: [] });
    expect(r.backupPath).toContain(path.join(t.dataDir, 'backups'));
    const backup = fs.readFileSync(r.backupPath, 'utf8');
    expect(backup).toContain(t.r1.id);
    expect(backup).toContain(t.r2.id);
    const st = await t.state();
    expect(st.feedback.map((f: { id: string }) => f.id)).toEqual(['22222222-2222-4222-8222-222222222222']);
    expect(st.feedback[0]).toMatchObject({ status: 'Accept with conditions', comment: 'needs work', reviewerName: 'Ada', scope: 'document' });
    expect(st.participants).toHaveLength(1); // participants are kept
    // the token is single use
    expect((await t.commit(p.token, 'replace')).status).toBe(410);
  });

  it('full round trip: export, Replace, and every field comes back identical', async () => {
    const t = await seeded();
    const before = (await t.state()).feedback;
    const { text } = await t.exp();
    const p = await t.preview(text);
    expect(p.duplicates).toBe(2);
    await t.commit(p.token, 'replace');
    const after = (await t.state()).feedback;
    expect(after).toEqual(before);
  });

  it('Merge: skips ids that already exist, reports them, and adds the rest', async () => {
    const t = await seeded();
    const { text } = await t.exp();
    const extra = `33333333-3333-4333-8333-333333333333,doc,${'0'.repeat(64)},document,Reject,Bob,reviewer,2026-11-18T10:00:00+10:00,2026-11-18T10:00:00+10:00,nope,,,,,,\r\n`;
    const p = await t.preview(text + extra);
    expect(p).toMatchObject({ validRows: 3, duplicates: 2, newReviewers: ['Bob'] });
    const r = await (await t.commit(p.token, 'merge')).json();
    expect(r.imported).toBe(1);
    expect(r.duplicates.sort()).toEqual([t.r1.id, t.r2.id].sort());
    expect(r.addedReviewers).toEqual(['Bob']);
    expect(r.backupPath).toBeNull(); // merge is not destructive
    const st = await t.state();
    expect(st.feedback).toHaveLength(3);
    expect(st.participants.map((x: { name: string; role: string }) => [x.name, x.role])).toEqual([['Ada', 'author'], ['Bob', 'reviewer']]);
    // merging never overwrites an existing item
    const edited = text.replace('because', 'x').replace(/Reject/g, 'Accept');
    const p2 = await t.preview(edited);
    await t.commit(p2.token, 'merge');
    expect((await t.state()).feedback.find((f: { id: string }) => f.id === t.r1.id).status).toBe('Reject');
  });

  it('matches reviewers case-insensitively and adds unknown ones with the role from the file', async () => {
    const t = await seeded();
    const { text } = await t.exp();
    const rows = [
      `44444444-4444-4444-8444-444444444444,doc,,document,Accept,ADA,reviewer,2026-11-18T10:00:00+10:00,,,,,,,,`,
      `55555555-5555-4555-8555-555555555555,doc,,document,Accept,New Person,author,2026-11-18T10:00:00+10:00,,,,,,,,`,
    ].join('\r\n');
    const p = await t.preview(`${text.split('\r\n')[0]}\r\n${rows}\r\n`);
    const r = await (await t.commit(p.token, 'merge')).json();
    expect(r.addedReviewers).toEqual(['New Person']);
    const st = await t.state();
    expect(st.participants.map((x: { name: string }) => x.name)).toEqual(['Ada', 'New Person']);
    expect(st.participants[1].role).toBe('author');
    expect(st.feedback.find((f: { id: string }) => f.id === '44444444-4444-4444-8444-444444444444').reviewerName).toBe('Ada');
  });

  it('imports nothing, makes no backup and deletes nothing when every row is invalid', async () => {
    const t = await seeded();
    const p = await t.preview(`id,scope,status,reviewer,created_at,comment,start_offset,end_offset,quote_exact\r\nx,page,Maybe,,no,,,,\r\n`);
    expect(p.validRows).toBe(0);
    expect(p.token).toBeNull();
    expect(p.errors).toHaveLength(1);
    expect((await t.commit(null, 'replace')).status).toBe(410);
    expect((await t.state()).feedback).toHaveLength(2);
    expect(fs.existsSync(path.join(t.dataDir, 'backups'))).toBe(false);
  });

  it('rejects unusable files in the preview step', async () => {
    const t = await seeded();
    const bad = await t.json('POST', '/api/import/preview', { content: 'id,scope\r\n1,document' });
    expect(bad.status).toBe(400);
    expect((await bad.json()).fatal).toMatch(/Missing required columns/);
    expect((await t.json('POST', '/api/import/preview', { content: '' })).status).toBe(400);
    expect((await t.commit('nope', 'wrong')).status).toBe(400);
  });

  it('aborts Replace and changes nothing if the backup cannot be written', async () => {
    const t = await seeded();
    const { text } = await t.exp();
    fs.writeFileSync(path.join(t.dataDir, 'backups'), 'a file where the directory should be');
    const p = await t.preview(text);
    const res = await t.commit(p.token, 'replace');
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/nothing was changed/);
    expect((await t.state()).feedback).toHaveLength(2);
  });

  it('reports ids that belong to another review session as conflicts', async () => {
    const a = await seeded();
    const { text } = await a.exp();
    // a second app instance on the same data dir, reviewing a different document
    const b = setup(a.dataDir);
    await b.load();
    await b.json('POST', '/api/participants', { name: 'Ada' });
    const p = (await (await b.json('POST', '/api/import/preview', { content: text })).json());
    const r = await (await b.json('POST', '/api/import/commit', { token: p.token, mode: 'merge' })).json();
    expect(r.imported).toBe(0);
    expect(r.conflicts).toHaveLength(2);
    expect((await (await b.json('GET', '/api/state')).json()).feedback).toHaveLength(0);
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
    expect(nowIso(new Date(2026, 10, 18, 15, 47, 35))).toMatch(/^2026-11-18T15:47:35\.000[+-]\d\d:\d\d$/);
  });
});
