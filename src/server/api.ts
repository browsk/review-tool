import type { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { validateFeedback } from '../feedback/model.js';
import { parseParticipants } from '../feedback/participants.js';
import { DuplicateParticipantError, NotFoundError, ParticipantInUseError, type Repos } from '../db/repos.js';
import type { AppState } from './app.js';

export function registerApi(app: Hono, deps: { repos: Repos; state: AppState }) {
  const { repos, state } = deps;

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
  const n = ps.filter((p) => p.role === 'author').length;
  return n === 1 ? [] : [`Exactly one author is expected; found ${n}.`];
}
