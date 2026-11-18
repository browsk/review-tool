import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

/**
 * Azure DevOps pull request loading (FR2). Only `dev.azure.com` and `{org}.visualstudio.com` hosts are
 * ever contacted with the token; redirects are never followed; the token is never logged or persisted.
 */

export type AdoErrorKind = 'url' | 'auth' | 'forbidden' | 'notfound' | 'network' | 'data' | 'limit';

export class AdoError extends Error {
  constructor(message: string, public kind: AdoErrorKind) {
    super(message);
  }
}

export interface AdoRef {
  org: string;
  project: string;
  repo: string;
  prId: number;
  legacyHost: boolean;
}

const HELP = 'Expected https://dev.azure.com/{organisation}/{project}/_git/{repository}/pullrequest/{id} (or the older https://{organisation}.visualstudio.com/{project}/_git/{repository}/pullrequest/{id}).';

export function parsePrUrl(input: string): AdoRef {
  const bad = (why: string): never => {
    throw new AdoError(`${why} ${HELP}`, 'url');
  };
  const raw = (input ?? '').trim();
  if (!raw) return bad('Please enter the pull request URL.');
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return bad('That is not a valid URL.');
  }
  if (u.protocol !== 'https:') return bad('The URL must start with https://.');
  if (u.username || u.password) return bad('The URL must not contain credentials.');
  if (u.port) return bad('Custom ports are not supported.');
  const host = u.hostname.toLowerCase();
  let segs: string[];
  try {
    segs = u.pathname.split('/').filter(Boolean).map((s) => decodeURIComponent(s));
  } catch {
    return bad('The URL contains invalid percent-encoding.');
  }
  let org: string;
  let legacyHost = false;
  if (host === 'dev.azure.com') {
    org = segs.shift() ?? '';
  } else {
    const m = /^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)\.visualstudio\.com$/.exec(host);
    if (!m) return bad(`"${u.hostname}" is not an Azure DevOps host.`);
    org = m[1] as string;
    legacyHost = true;
    if (segs[0]?.toLowerCase() === 'defaultcollection') segs.shift();
  }
  // [project?] _git {repo} pullrequest {id}
  const gi = segs.findIndex((s) => s.toLowerCase() === '_git');
  if (!org || gi < 0 || gi > 1 || segs.length !== gi + 4 || segs[gi + 2]?.toLowerCase() !== 'pullrequest') {
    return bad('This does not look like a pull request URL.');
  }
  const repo = segs[gi + 1] as string;
  const project = gi === 1 ? (segs[0] as string) : repo; // the default repository shares the project's name
  const idStr = segs[gi + 3] as string;
  if (!/^\d+$/.test(idStr) || Number(idStr) < 1) return bad('The pull request number must be a positive integer.');
  for (const part of [org, project, repo]) {
    if (!part || /[\\/\0]/.test(part) || part === '.' || part === '..') return bad('The organisation, project or repository name is not valid.');
  }
  return { org, project, repo, prId: Number(idStr), legacyHost };
}

// ------------------------------------------------------------------ change filtering

export interface AdoChange {
  changeType?: string;
  item?: { path?: string; isFolder?: boolean };
}

/** Paths of files ADDED in the change list that have a .md extension (flag values like "add, edit" count as added). */
export function addedMarkdownPaths(changes: AdoChange[]): string[] {
  const out = new Set<string>();
  for (const c of changes) {
    const flags = String(c.changeType ?? '').toLowerCase().split(',').map((s) => s.trim());
    const p = c.item?.path;
    if (!flags.includes('add') || flags.includes('delete') || c.item?.isFolder || typeof p !== 'string') continue;
    if (/\.md$/i.test(p)) out.add(p);
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

// ------------------------------------------------------------------ images

/** Relative image references in a markdown document (markdown and HTML <img> syntax). */
export function extractImageRefs(markdown: string): string[] {
  const refs = new Set<string>();
  for (const m of markdown.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^)]*["'])?\s*\)/g)) refs.add(m[1] as string);
  for (const m of markdown.matchAll(/<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi)) refs.add(m[1] as string);
  return [...refs]
    .map((r) => {
      try {
        return decodeURI(r.split(/[?#]/)[0] as string);
      } catch {
        return r;
      }
    })
    .filter((r) => r && !/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(r));
}

/** Normalise a relative image path; null if it escapes the document's directory or is otherwise unsafe. */
export function safeRelImage(rel: string): string | null {
  if (/[\0\\:]/.test(rel)) return null;
  const n = path.posix.normalize(rel);
  if (n.startsWith('../') || n === '..' || n.startsWith('/') || n === '.' || n.endsWith('/')) return null;
  return n;
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg)$/i;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_DOC_BYTES = 5 * 1024 * 1024;

// ------------------------------------------------------------------ client

export interface AdoClientOptions {
  pat: string;
  fetch?: typeof fetch;
  /** Override the API origin (tests only): requests go to `${apiBase}/${org}/...` */
  apiBase?: string;
  timeoutMs?: number;
}

export interface AdoClient {
  ref: AdoRef;
  getPullRequestTitle(): Promise<string>;
  latestSourceCommit(): Promise<{ iteration: number; commit: string }>;
  listAddedMarkdown(): Promise<{ title: string; commit: string; iteration: number; files: string[] }>;
  fetchFile(filePath: string, commit: string, maxBytes: number): Promise<Buffer>;
}

const enc = encodeURIComponent;

export function createAdoClient(ref: AdoRef, opts: AdoClientOptions): AdoClient {
  const doFetch = opts.fetch ?? fetch;
  const timeout = opts.timeoutMs ?? 20_000;
  const auth = `Basic ${Buffer.from(`:${opts.pat}`).toString('base64')}`;
  const origin = opts.apiBase ? `${opts.apiBase.replace(/\/+$/, '')}/${enc(ref.org)}` : ref.legacyHost ? `https://${ref.org}.visualstudio.com` : `https://dev.azure.com/${enc(ref.org)}`;
  const repoBase = `${origin}/${enc(ref.project)}/_apis/git/repositories/${enc(ref.repo)}`;

  async function request(url: string, accept: string): Promise<Response> {
    let res: Response;
    try {
      res = await doFetch(url, {
        headers: { Authorization: auth, Accept: accept, 'User-Agent': 'review-tool' },
        redirect: 'manual', // never follow redirects: the token must not leave the allowed host
        signal: AbortSignal.timeout(timeout),
      });
    } catch (e) {
      const name = (e as Error).name;
      if (name === 'TimeoutError' || name === 'AbortError') throw new AdoError('Azure DevOps did not respond in time.', 'network');
      throw new AdoError('Could not reach Azure DevOps. Check your network connection.', 'network');
    }
    const type = res.headers.get('content-type') ?? '';
    // a bad PAT usually yields a redirect or a 203 with an HTML sign-in page rather than a clean 401
    if (res.status === 401 || res.status === 203 || (res.status >= 300 && res.status < 400) || res.type === 'opaqueredirect' || (res.ok && /text\/html/i.test(type) && accept.includes('json'))) {
      throw new AdoError('Azure DevOps rejected the personal access token (it may be wrong, expired, or missing the "Code (Read)" scope).', 'auth');
    }
    if (res.status === 403) throw new AdoError('The token does not have access to this repository or pull request.', 'forbidden');
    if (res.status === 404) throw new AdoError('Pull request not found. Check the organisation, project, repository and pull request number in the URL.', 'notfound');
    if (res.status === 429) throw new AdoError('Azure DevOps is rate limiting requests. Try again in a minute.', 'network');
    if (!res.ok) throw new AdoError(`Azure DevOps returned an error (HTTP ${res.status}).`, 'network');
    return res;
  }

  async function json<T>(url: string): Promise<T> {
    const res = await request(url, 'application/json');
    try {
      return (await res.json()) as T;
    } catch {
      throw new AdoError('Azure DevOps returned an unexpected response.', 'data');
    }
  }

  const prBase = `${repoBase}/pullRequests/${ref.prId}`;
  const v = 'api-version=7.1';

  return {
    ref,

    async getPullRequestTitle() {
      const pr = await json<{ title?: string }>(`${prBase}?${v}`);
      return typeof pr.title === 'string' ? pr.title : `Pull request ${ref.prId}`;
    },

    async latestSourceCommit() {
      const data = await json<{ value?: { id?: number; sourceRefCommit?: { commitId?: string } }[] }>(`${prBase}/iterations?${v}`);
      const its = (data.value ?? []).filter((i) => typeof i.id === 'number' && i.sourceRefCommit?.commitId);
      if (!its.length) throw new AdoError('The pull request has no iterations (no pushed commits).', 'data');
      const latest = its.reduce((a, b) => ((b.id as number) > (a.id as number) ? b : a));
      return { iteration: latest.id as number, commit: latest.sourceRefCommit!.commitId as string };
    },

    async listAddedMarkdown() {
      const [title, { iteration, commit }] = await Promise.all([this.getPullRequestTitle(), this.latestSourceCommit()]);
      const changes: AdoChange[] = [];
      const top = 100;
      for (let skip = 0, page = 0; page < 200; page++) {
        const data = await json<{ changeEntries?: AdoChange[]; nextSkip?: number; nextTop?: number }>(
          `${prBase}/iterations/${iteration}/changes?${v}&$top=${top}&$skip=${skip}`,
        );
        changes.push(...(data.changeEntries ?? []));
        if (!data.nextSkip || !data.changeEntries?.length) break;
        skip = data.nextSkip;
      }
      return { title, commit, iteration, files: addedMarkdownPaths(changes) };
    },

    async fetchFile(filePath, commit, maxBytes) {
      const url =
        `${repoBase}/items?path=${enc(filePath)}&versionDescriptor.versionType=commit&versionDescriptor.version=${enc(commit)}` +
        `&includeContent=true&download=true&${v}`;
      const res = await request(url, 'application/octet-stream');
      const len = Number(res.headers.get('content-length') ?? 0);
      if (len > maxBytes) throw new AdoError(`${filePath} is too large (limit ${Math.round(maxBytes / 1024 / 1024)} MB).`, 'limit');
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > maxBytes) throw new AdoError(`${filePath} is too large (limit ${Math.round(maxBytes / 1024 / 1024)} MB).`, 'limit');
      return buf;
    },
  };
}

// ------------------------------------------------------------------ loading a document + its images

export interface AdoDocument {
  source: string;
  sha256: string;
  name: string;
  /** directory holding the cached images; relative image paths resolve against it */
  dir: string;
  sourceKey: string;
  label: string;
  missingImages: string[];
}

export function cacheKey(ref: AdoRef, commit: string, filePath: string): string {
  return createHash('sha256').update(`${ref.org}/${ref.project}/${ref.repo}/${ref.prId}/${commit}/${filePath}`).digest('hex').slice(0, 24);
}

/** Fetch the markdown at the PR's latest source commit plus the relative images it references. */
export async function fetchAdoDocument(
  client: AdoClient,
  commit: string,
  filePath: string,
  cacheRoot: string,
  isBinary: (b: Buffer) => boolean,
  onBinary: (msg: string) => Error,
): Promise<AdoDocument> {
  const buf = await client.fetchFile(filePath, commit, MAX_DOC_BYTES);
  if (isBinary(buf)) throw onBinary(`File is binary or not valid UTF-8: ${filePath}`);
  const source = buf.toString('utf8').replace(/^﻿/, '');
  const ref = client.ref;
  const dir = path.join(cacheRoot, cacheKey(ref, commit, filePath));
  fs.mkdirSync(dir, { recursive: true });
  const mdDir = path.posix.dirname(filePath);
  const missing: string[] = [];

  const refs = extractImageRefs(source);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= refs.length) return;
      const rel = refs[i] as string;
      const safe = safeRelImage(rel);
      if (!safe || !IMAGE_EXT.test(safe)) {
        missing.push(rel);
        continue;
      }
      const target = path.resolve(dir, ...safe.split('/'));
      if (!target.startsWith(dir + path.sep)) {
        missing.push(rel);
        continue;
      }
      try {
        const data = await client.fetchFile(path.posix.join(mdDir === '.' ? '/' : mdDir, safe), commit, MAX_IMAGE_BYTES);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, data);
      } catch (e) {
        // a missing or unreadable image must not stop the document; auth/network failures abort
        if (e instanceof AdoError && (e.kind === 'auth' || e.kind === 'forbidden' || e.kind === 'network')) throw e;
        missing.push(rel);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, refs.length) }, worker));

  return {
    source,
    sha256: createHash('sha256').update(buf).digest('hex'),
    name: path.posix.basename(filePath).replace(/\.md$/i, ''),
    dir,
    sourceKey: `ado:${ref.org}/${ref.project}/${ref.repo}/${ref.prId}${filePath}`,
    label: `${ref.org}/${ref.project}/${ref.repo} PR #${ref.prId}: ${filePath}`,
    missingImages: missing,
  };
}
