import type { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { randomUUID } from 'node:crypto';
import { authorWarning, validateFeedback } from '../feedback/model.js';
import { exportCsv, exportFilename, parseImport, summarise, type ImportRow } from '../feedback/csv.js';
import { writeBackup } from '../feedback/backup.js';
import { parseParticipants } from '../feedback/participants.js';
import { DuplicateParticipantError, NotFoundError, ParticipantInUseError, type Repos } from '../db/repos.js';
import type { AppState } from './app.js';

interface PendingImport {
  rows: ImportRow[];
  expires: number;
}

export function registerApi(app: Hono, deps: { repos: Repos; state: AppState; dataDir: string }) {
  const { repos, state, dataDir } = deps;
  const pending = new Map<string, PendingImport>();
  const pruneImports = () => {
    const now = Date.now();
    for (const [k, v] of pending) if (v.expires < now) pending.delete(k);
  };

  app.use('/api/*', bodyLimit({ maxSize: 2 * 1024 * 1024, onError: (c) => c.json({ error: 'Request too large.' }, 413) }));
  app.use('/api/*', async (c, next) => {
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD' && !(c.req.header('content-type') ?? '').includes('application/json')) {
      return c.json({ error: 'Content-Type must be application/json.' }, 415);
    }
    await next();
  });

  const session = () => (state.doc?.sessionId ? repos.getSession(state.doc.sessionId) : undefined);
  const body = async (c: { req: { json: () => Promise<unknown> } }): Promise<Record<string, unknown>> => {
    try {
      const b = await c.req.json();
      return b && typeof b === 'object' ? (b as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  };

  app.get('/api/state', (c) => {
    const s = session();
    if (!s || !state.doc) return c.json({ error: 'No document loaded.' }, 409);
    return c.json({
      session: { id: s.id, docName: s.docName, sha256: state.doc.sha256, lastReviewerId: s.lastReviewerId },
      needsReanchor: state.doc.diagnostics.some((d) => d.code === 'hash-changed'),
      participants: repos.listParticipants(s.id),
      feedback: repos.listFeedback(s.id),
    });
  });

  // ---- participants
  app.post('/api/participants', async (c) => {
    const s = session();
    if (!s) return c.json({ error: 'No document loaded.' }, 409);
    const b = await body(c);
    const name = typeof b.name === 'string' ? b.name.trim() : '';
    if (!name) return c.json({ errors: { name: 'Name is required.' } }, 400);
    if (name.length > 200) return c.json({ errors: { name: 'Name is too long.' } }, 400);
    const role = b.role === 'author' ? 'author' : b.role === undefined || b.role === 'reviewer' || b.role === '' ? 'reviewer' : null;
    if (!role) return c.json({ errors: { role: 'Role must be author or reviewer.' } }, 400);
    const email = typeof b.email === 'string' ? b.email.slice(0, 300) : undefined;
    try {
      const p = repos.addParticipant(s.id, { name, email, role });
      return c.json({ participant: p, participants: repos.listParticipants(s.id) }, 201);
    } catch (e) {
      if (e instanceof DuplicateParticipantError) return c.json({ errors: { name: e.message } }, 409);
      throw e;
    }
  });

  app.post('/api/participants/import', async (c) => {
    const s = session();
    if (!s) return c.json({ error: 'No document loaded.' }, 409);
    const b = await body(c);
    const filename = typeof b.filename === 'string' ? b.filename : '';
    const content = typeof b.content === 'string' ? b.content : '';
    const r = parseParticipants(filename, content);
    if (r.fatal || r.errors.length) return c.json({ fatal: r.fatal, errors: r.errors }, 400);
    const existing = new Set(repos.listParticipants(s.id).map((p) => p.name.toLowerCase()));
    const added: string[] = [];
    const skipped: string[] = [];
    repos.db.transaction(() => {
      for (const p of r.participants) {
        if (existing.has(p.name.toLowerCase())) skipped.push(p.name);
        else {
          repos.addParticipant(s.id, p);
          added.push(p.name);
        }
      }
    })();
    const participants = repos.listParticipants(s.id);
    return c.json({ added, skipped, participants, warnings: authorWarnings(participants) });
  });

  app.delete('/api/participants/:id', (c) => {
    const s = session();
    if (!s) return c.json({ error: 'No document loaded.' }, 409);
    try {
      repos.deleteParticipant(s.id, c.req.param('id'));
      return c.json({ participants: repos.listParticipants(s.id) });
    } catch (e) {
      if (e instanceof ParticipantInUseError) return c.json({ error: e.message }, 409);
      if (e instanceof NotFoundError) return c.json({ error: e.message }, 404);
      throw e;
    }
  });

  app.patch('/api/participants/:id', async (c) => {
    const s = session();
    if (!s) return c.json({ error: 'No document loaded.' }, 409);
    const b = await body(c);
    if (b.role !== 'author' && b.role !== 'reviewer') return c.json({ errors: { role: 'Role must be author or reviewer.' } }, 400);
    try {
      repos.setParticipantRole(s.id, c.req.param('id'), b.role);
    } catch (e) {
      if (e instanceof NotFoundError) return c.json({ error: e.message }, 404);
      throw e;
    }
    const participants = repos.listParticipants(s.id);
    return c.json({ participants, warnings: authorWarnings(participants) });
  });

  // ---- CSV export / import
  app.get('/export.csv', (c) => {
    const s = session();
    if (!s || !state.doc) return c.text('No document loaded.', 409);
    const csv = exportCsv(repos.listFeedback(s.id), s.docName, state.doc.sha256);
    const name = exportFilename(s.docName);
    const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      },
    });
  });

  /** Step 1: validate the file and describe what an import would do; nothing is changed. */
  app.post('/api/import/preview', async (c) => {
    const s = session();
    if (!s || !state.doc) return c.json({ error: 'No document loaded.' }, 409);
    const b = await body(c);
    const content = typeof b.content === 'string' ? b.content : '';
    const p = parseImport(content, state.doc.sha256);
    if (p.fatal) return c.json({ fatal: p.fatal }, 400);
    pruneImports();
    let token: string | null = null;
    if (p.rows.length) {
      token = randomUUID();
      pending.set(token, { rows: p.rows, expires: Date.now() + 15 * 60_000 });
    }
    const existing = repos.listFeedback(s.id);
    const existingIds = new Set(existing.map((f) => f.id));
    const known = new Set(repos.listParticipants(s.id).map((x) => x.name.toLowerCase()));
    const newReviewers = [...new Map(p.rows.filter((r) => !known.has(r.reviewer.toLowerCase())).map((r) => [r.reviewer.toLowerCase(), r.reviewer])).values()];
    return c.json({
      token,
      totalRows: p.totalRows,
      validRows: p.rows.length,
      ...summarise(p.rows),
      errors: p.errors,
      hashMismatch: p.mismatchedShas.length > 0,
      newReviewers,
      duplicates: p.rows.filter((r) => existingIds.has(r.id)).length,
      existingCount: existing.length,
    });
  });

  /** Step 2: apply a previewed import (replace or merge) in one transaction. */
  app.post('/api/import/commit', async (c) => {
    const s = session();
    if (!s || !state.doc) return c.json({ error: 'No document loaded.' }, 409);
    const b = await body(c);
    if (b.mode !== 'replace' && b.mode !== 'merge') return c.json({ error: 'Choose Replace or Merge.' }, 400);
    pruneImports();
    const entry = typeof b.token === 'string' ? pending.get(b.token) : undefined;
    if (!entry) return c.json({ error: 'This import has expired. Choose the file again.' }, 410);
    if (!entry.rows.length) return c.json({ error: 'There are no valid rows to import.' }, 400);

    let backupPath: string | null = null;
    if (b.mode === 'replace') {
      const current = repos.listFeedback(s.id);
      if (current.length) {
        try {
          backupPath = writeBackup(dataDir, s.docName, exportCsv(current, s.docName, state.doc.sha256));
        } catch {
          return c.json({ error: 'Could not write the automatic backup, so nothing was changed.' }, 500);
        }
      }
    }
    const r = repos.importFeedback(s.id, b.mode, entry.rows);
    pending.delete(b.token as string);
    return c.json({
      mode: b.mode,
      imported: r.imported.length,
      importedIds: r.imported,
      duplicates: r.duplicates,
      conflicts: r.conflicts,
      addedReviewers: r.addedReviewers,
      backupPath,
    });
  });

  // ---- feedback
  app.post('/api/feedback', async (c) => {
    const s = session();
    if (!s || !state.doc) return c.json({ error: 'No document loaded.' }, 409);
    const v = validateFeedback(await body(c));
    if (!v.value) return c.json({ errors: v.errors }, 400);
    if (!repos.listParticipants(s.id).some((p) => p.id === v.value!.reviewerId)) {
      return c.json({ errors: { reviewerId: 'Unknown reviewer.' } }, 400);
    }
    const fb = repos.createFeedback(s.id, v.value, state.doc.sha256);
    return c.json({ feedback: fb }, 201);
  });

  app.patch('/api/feedback/:id', async (c) => {
    const s = session();
    if (!s) return c.json({ error: 'No document loaded.' }, 409);
    const b = await body(c);
    const v = validateFeedback({ status: b.status, comment: b.comment, reviewerId: b.reviewerId }, true);
    if (!v.value) return c.json({ errors: v.errors }, 400);
    if (!repos.listParticipants(s.id).some((p) => p.id === v.value!.reviewerId)) {
      return c.json({ errors: { reviewerId: 'Unknown reviewer.' } }, 400);
    }
    try {
      return c.json({ feedback: repos.updateFeedback(s.id, c.req.param('id'), v.value) });
    } catch (e) {
      if (e instanceof NotFoundError) return c.json({ error: e.message }, 404);
      throw e;
    }
  });

  app.delete('/api/feedback/:id', (c) => {
    const s = session();
    if (!s) return c.json({ error: 'No document loaded.' }, 409);
    try {
      repos.deleteFeedback(s.id, c.req.param('id'));
      return c.json({ ok: true });
    } catch (e) {
      if (e instanceof NotFoundError) return c.json({ error: e.message }, 404);
      throw e;
    }
  });

  /** Client re-attached anchors against the current text; persist new offsets and the hash. */
  app.post('/api/session/reanchor', async (c) => {
    const s = session();
    if (!s || !state.doc) return c.json({ error: 'No document loaded.' }, 409);
    const b = await body(c);
    if (b.sha256 !== state.doc.sha256) return c.json({ error: 'Document hash does not match the loaded document.' }, 409);
    const raw = Array.isArray(b.updates) ? b.updates : [];
    const updates = raw.filter(
      (u): u is { id: string; start: number; end: number } =>
        !!u && typeof u.id === 'string' && Number.isInteger(u.start) && Number.isInteger(u.end) && u.start >= 0 && u.end > u.start,
    );
    repos.applyReanchor(s.id, updates, state.doc.sha256);
    if (state.doc) state.doc.diagnostics = state.doc.diagnostics.filter((d) => d.code !== 'hash-changed');
    return c.json({ updated: updates.length });
  });
}

export function authorWarnings(ps: { role: string }[]): string[] {
  const w = authorWarning(ps.filter((p) => p.role === 'author').length);
  return w ? [w] : [];
}
