import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import type { Config } from './config.js';
import { looksBinary, renderMarkdown } from '../render/pipeline.js';
import { AdoError, createAdoClient, fetchAdoDocument, parsePrUrl } from '../sources/ado.js';
import type { Section } from '../render/sections.js';
import { indicatorFor, type Diagnostic } from '../render/diagnostics.js';
import { IMAGE_MIME, LoadError, PathError, ReadFailure, assetExists, loadLocalDocument, resolveSafe } from '../sources/local.js';
import { addRecent, readRecent } from '../sources/recent.js';
import { pickFileNative, type FilePicker } from '../sources/picker.js';
import { openDb } from '../db/db.js';
import { createRepos } from '../db/repos.js';
import { registerApi } from './api.js';
import { Page, StartForm, DocumentView, DiagnosticsPanel } from './views.js';

export interface CurrentDoc {
  name: string;
  dir: string | null;
  sha256: string;
  html: string;
  frontmatter?: string;
  diagnostics: Diagnostic[];
  sections: Section[];
  /** review session (feedback + participants) for this document; null when it could not be read */
  sessionId: string | null;
  /** where the document came from, for humans (file path or pull request) */
  sourceLabel?: string;
}

export interface AppState {
  doc: CurrentDoc | null;
  token: string;
  /** PAT typed into the UI. Held in memory only: never written to the database, logs, cache or exports. */
  adoPat?: string;
}

export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ');

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

export function createApp(config: Config, deps: { pickFile?: FilePicker } = {}) {
  const pickFile = deps.pickFile ?? pickFileNative;
  const state: AppState = { doc: null, token: randomBytes(24).toString('hex') };
  const app = new Hono();
  const repos = createRepos(openDb(config.dataDir));

  const allowedHosts = new Set([`127.0.0.1:${config.port}`, `localhost:${config.port}`, `[::1]:${config.port}`]);

  // Host allowlist, CSRF checks and security headers
  app.use('*', async (c: Context, next: Next) => {
    const host = c.req.header('host') ?? '';
    if (!config.lan && !allowedHosts.has(host) && !/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host)) {
      return c.text('Forbidden host', 403);
    }
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      const site = c.req.header('sec-fetch-site');
      if (site && site !== 'same-origin' && site !== 'none') return c.text('Cross-site request blocked', 403);
      const origin = c.req.header('origin');
      if (origin === 'null') {
        // browsers send Origin: null for same-origin forms under Referrer-Policy: no-referrer
        if (site !== 'same-origin') return c.text('Cross-origin request blocked', 403);
      } else if (origin) {
        let oh = '';
        try {
          oh = new URL(origin).host;
        } catch {
          /* invalid */
        }
        if (oh !== host) return c.text('Cross-origin request blocked', 403);
      }
      const ct = c.req.header('content-type') ?? '';
      let token = c.req.header('x-review-token');
      if (!token && ct.includes('application/x-www-form-urlencoded')) {
        const form = await c.req.parseBody();
        token = typeof form._token === 'string' ? form._token : undefined;
      }
      if (token !== state.token) return c.text('Missing or invalid token', 403);
    }
    await next();
    // routes may set a stricter policy of their own (e.g. sandboxed SVG assets); do not overwrite it
    if (!c.res.headers.has('Content-Security-Policy')) c.res.headers.set('Content-Security-Policy', CSP);
    c.res.headers.set('X-Content-Type-Options', 'nosniff');
    c.res.headers.set('Referrer-Policy', 'no-referrer');
    c.res.headers.set('Cache-Control', 'no-store');
  });

  registerApi(app, { repos, state, dataDir: config.dataDir });

  const page = (c: Context, opts: { error?: string; status?: 200 | 400 | 401 | 403 | 404 | 422 | 502; ado?: { url: string; files: string[]; title?: string } } = {}) =>
    c.html(
      <Page token={state.token} doc={state.doc} navMaxLevel={config.navMaxLevel} sectionLevel={config.sectionLevel}>
        <StartForm
          token={state.token}
          recent={readRecent(config.dataDir)}
          error={opts.error}
          patSource={state.adoPat ? 'session' : config.adoPat ? 'env' : null}
          adoPicker={opts.ado}
          collapsed={!!state.doc?.html && !opts.error && !opts.ado}
        />
        {state.doc ? <DocumentView doc={state.doc} navMaxLevel={config.navMaxLevel} sectionLevel={config.sectionLevel} /> : <p class="empty">No document loaded.</p>}
      </Page>,
      opts.status ?? 200,
    );

  /** Render a document, resume or create its review session, and make it the current document. */
  async function openDocument(a: { name: string; dir: string | null; sha256: string; source: string; sourceKey: string; label: string }): Promise<void> {
    const r = await renderMarkdown(a.source, {
      assetExists: (rel) => (a.dir ? assetExists(a.dir, rel) : false),
      sectionLevel: config.sectionLevel,
      diagrams: config.diagrams,
    });
    const s = repos.getOrCreateSession(a.sourceKey, a.name, a.sha256);
    const diagnostics = [...r.diagnostics];
    if (s.hashChanged) {
      diagnostics.push({
        severity: 'warning',
        code: 'hash-changed',
        message: 'This document has changed since it was last reviewed. Existing feedback is being re-anchored to the new text.',
      });
    }
    state.doc = {
      name: a.name,
      dir: a.dir,
      sha256: a.sha256,
      html: r.html,
      frontmatter: r.frontmatter,
      diagnostics,
      sections: r.sections,
      sessionId: s.session.id,
      sourceLabel: a.label,
    };
  }

  const readFailureDoc = (name: string, message: string): void => {
    state.doc = { name, dir: null, sha256: '', html: '', diagnostics: [{ severity: 'error', code: 'read-failure', message }], sections: [], sessionId: null };
  };

  app.get('/', (c) => page(c));

  let picking = false;
  /** Open the OS file dialog on this machine and return the chosen path (token-protected like every POST). */
  app.post('/api/pick-file', async (c) => {
    if (picking) return c.json({ error: 'A file dialog is already open.' }, 409);
    picking = true;
    try {
      const r = await pickFile();
      return c.json(r, 'error' in r ? 501 : 200);
    } finally {
      picking = false;
    }
  });

  app.post('/load/local', async (c) => {
    const form = await c.req.parseBody();
    const input = typeof form.path === 'string' ? form.path : '';
    try {
      const doc = loadLocalDocument(input);
      await openDocument({ name: doc.name, dir: doc.dir, sha256: doc.sha256, source: doc.source, sourceKey: `local:${doc.path}`, label: doc.path });
      addRecent(config.dataDir, doc.path);
      return page(c);
    } catch (err) {
      if (err instanceof ReadFailure) {
        readFailureDoc(path.basename(err.filePath), err.message);
        return page(c);
      }
      if (err instanceof LoadError) return page(c, { error: err.message, status: 400 });
      return page(c, { error: 'Unexpected error loading the document.', status: 400 });
    }
  });

  const ADO_STATUS = { url: 400, auth: 401, forbidden: 403, notfound: 404, network: 502, data: 502, limit: 400 } as const;

  /** Load a markdown file added by an Azure DevOps pull request (FR2). */
  app.post('/load/ado', async (c) => {
    const form = await c.req.parseBody();
    const url = typeof form.url === 'string' ? form.url : '';
    const chosen = typeof form.file === 'string' && form.file ? form.file : undefined;
    const entered = typeof form.pat === 'string' ? form.pat.trim() : '';
    const pat = entered || state.adoPat || config.adoPat;
    try {
      const ref = parsePrUrl(url);
      if (!pat) throw new AdoError('A personal access token is required. Enter one below or set the ADO_PAT environment variable.', 'auth');
      const client = createAdoClient(ref, { pat, apiBase: config.adoApiBase });
      const found = await client.listAddedMarkdown();
      if (entered) state.adoPat = entered; // remembered (in memory only) once Azure DevOps has accepted it, e.g. for the file picker
      if (!found.files.length) {
        return page(c, { error: 'No new markdown (.md) files were added in this pull request. Only files that the pull request adds are reviewed.', status: 422 });
      }
      if (chosen && !found.files.includes(chosen)) {
        return page(c, { error: 'That file is not one of the markdown files added by this pull request.', status: 400, ado: { url, files: found.files, title: found.title } });
      }
      const file = chosen ?? (found.files.length === 1 ? found.files[0] : undefined);
      if (!file) return page(c, { ado: { url, files: found.files, title: found.title } }); // several: show the picker
      const doc = await fetchAdoDocument(client, found.commit, file, path.join(config.dataDir, 'cache', 'ado'), looksBinary, (m) => new ReadFailure(m, file));
      await openDocument({ name: doc.name, dir: doc.dir, sha256: doc.sha256, source: doc.source, sourceKey: doc.sourceKey, label: doc.label });
      return page(c);
    } catch (err) {
      if (err instanceof ReadFailure) {
        readFailureDoc(path.basename(err.filePath), err.message);
        return page(c);
      }
      if (err instanceof AdoError) {
        if (err.kind === 'auth' && !entered && pat === state.adoPat) state.adoPat = undefined; // forget a remembered token that stopped working
        return page(c, { error: err.message, status: ADO_STATUS[err.kind] });
      }
      return page(c, { error: 'Unexpected error loading the pull request.', status: 502 });
    }
  });

  app.get('/diagnostics', (c) => c.html(<DiagnosticsPanel diagnostics={state.doc?.diagnostics ?? []} />));

  app.get('/assets/*', (c) => {
    if (!state.doc?.dir) return c.text('Not found', 404);
    const rel = c.req.path.slice('/assets/'.length);
    try {
      const real = resolveSafe(state.doc.dir, rel);
      const mime = IMAGE_MIME[path.extname(real).toLowerCase()];
      if (!mime) return c.text('Unsupported asset type', 403);
      const headers: Record<string, string> = { 'Content-Type': mime };
      if (mime === 'image/svg+xml') headers['Content-Security-Policy'] = "sandbox; default-src 'none'; style-src 'unsafe-inline'";
      return new Response(new Uint8Array(fs.readFileSync(real)), { headers });
    } catch (err) {
      if (err instanceof PathError) return c.text(err.message, err.status);
      return c.text('Not found', 404);
    }
  });

  app.get('/static/*', (c) => {
    const rel = c.req.path.slice('/static/'.length);
    try {
      const real = resolveSafe(PUBLIC_DIR, rel);
      const ext = path.extname(real).toLowerCase();
      const type = ext === '.js' ? 'text/javascript; charset=utf-8' : ext === '.css' ? 'text/css; charset=utf-8' : 'application/octet-stream';
      return new Response(new Uint8Array(fs.readFileSync(real)), { headers: { 'Content-Type': type } });
    } catch {
      return c.text('Not found', 404);
    }
  });

  return { app, state, indicatorFor };
}
