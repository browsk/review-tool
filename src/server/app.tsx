import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import type { Config } from './config.js';
import { renderMarkdown } from '../render/pipeline.js';
import type { Section } from '../render/sections.js';
import { indicatorFor, type Diagnostic } from '../render/diagnostics.js';
import { IMAGE_MIME, LoadError, PathError, ReadFailure, assetExists, loadLocalDocument, resolveSafe } from '../sources/local.js';
import { addRecent, readRecent } from '../sources/recent.js';
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
}

export interface AppState {
  doc: CurrentDoc | null;
  token: string;
}

export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ');

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

export function createApp(config: Config) {
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
    c.res.headers.set('Content-Security-Policy', CSP);
    c.res.headers.set('X-Content-Type-Options', 'nosniff');
    c.res.headers.set('Referrer-Policy', 'no-referrer');
    c.res.headers.set('Cache-Control', 'no-store');
  });

  registerApi(app, { repos, state });

  const page = (c: Context, opts: { error?: string; status?: 200 | 400 } = {}) =>
    c.html(
      <Page token={state.token} doc={state.doc} navMaxLevel={config.navMaxLevel} sectionLevel={config.sectionLevel}>
        <StartForm token={state.token} recent={readRecent(config.dataDir)} error={opts.error} />
        {state.doc ? <DocumentView doc={state.doc} navMaxLevel={config.navMaxLevel} sectionLevel={config.sectionLevel} /> : <p class="empty">No document loaded.</p>}
      </Page>,
      opts.status ?? 200,
    );

  app.get('/', (c) => page(c));

  app.post('/load/local', async (c) => {
    const form = await c.req.parseBody();
    const input = typeof form.path === 'string' ? form.path : '';
    try {
      const doc = loadLocalDocument(input);
      const r = await renderMarkdown(doc.source, {
        assetExists: (rel) => assetExists(doc.dir, rel),
        sectionLevel: config.sectionLevel,
      });
      const s = repos.getOrCreateSession(`local:${doc.path}`, doc.name, doc.sha256);
      const diagnostics = [...r.diagnostics];
      if (s.hashChanged) {
        diagnostics.push({
          severity: 'warning',
          code: 'hash-changed',
          message: 'This document has changed since it was last reviewed. Existing feedback is being re-anchored to the new text.',
        });
      }
      state.doc = {
        name: doc.name,
        dir: doc.dir,
        sha256: doc.sha256,
        html: r.html,
        frontmatter: r.frontmatter,
        diagnostics,
        sections: r.sections,
        sessionId: s.session.id,
      };
      addRecent(config.dataDir, doc.path);
      return page(c);
    } catch (err) {
      if (err instanceof ReadFailure) {
        state.doc = {
          name: path.basename(err.filePath),
          dir: null,
          sha256: '',
          html: '',
          diagnostics: [{ severity: 'error', code: 'read-failure', message: err.message }],
          sections: [],
          sessionId: null,
        };
        return page(c);
      }
      if (err instanceof LoadError) return page(c, { error: err.message, status: 400 });
      return page(c, { error: 'Unexpected error loading the document.', status: 400 });
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
