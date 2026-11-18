import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AdoError, addedMarkdownPaths, cacheKey, createAdoClient, extractImageRefs, fetchAdoDocument, parsePrUrl, safeRelImage, type AdoRef,
} from '../../src/sources/ado.js';
import { LATEST_COMMIT, PAT, handleAdo, mockFetch } from '../fixtures/ado/mock.js';
import { looksBinary } from '../../src/render/pipeline.js';

const URL1 = 'https://dev.azure.com/acme/Proj%20One/_git/platform/pullrequest/101';
const ref = (id: number): AdoRef => ({ org: 'acme', project: 'Proj One', repo: 'platform', prId: id, legacyHost: false });

describe('parsePrUrl', () => {
  it('parses dev.azure.com URLs (including encoded names, trailing slash, query and fragment)', () => {
    expect(parsePrUrl(URL1)).toEqual({ org: 'acme', project: 'Proj One', repo: 'platform', prId: 101, legacyHost: false });
    expect(parsePrUrl(`${URL1}/`).prId).toBe(101);
    expect(parsePrUrl(`${URL1}?_a=files&path=%2Fdocs#x`).prId).toBe(101);
    expect(parsePrUrl(' https://dev.azure.com/acme/p/_git/r/PullRequest/7 ').prId).toBe(7); // case-insensitive keywords, trimmed
  });

  it('parses the legacy {org}.visualstudio.com form, with and without DefaultCollection', () => {
    expect(parsePrUrl('https://acme.visualstudio.com/Proj/_git/platform/pullrequest/42')).toEqual({ org: 'acme', project: 'Proj', repo: 'platform', prId: 42, legacyHost: true });
    expect(parsePrUrl('https://acme.visualstudio.com/DefaultCollection/Proj/_git/platform/pullrequest/42').project).toBe('Proj');
    expect(parsePrUrl('https://ACME.VisualStudio.com/Proj/_git/platform/pullrequest/42').org).toBe('ACME'.toLowerCase());
  });

  it('uses the repository name as the project when the project segment is omitted', () => {
    expect(parsePrUrl('https://dev.azure.com/acme/_git/platform/pullrequest/9')).toMatchObject({ project: 'platform', repo: 'platform' });
  });

  it.each([
    ['empty', ''],
    ['not a URL', 'not a url'],
    ['http', 'http://dev.azure.com/acme/p/_git/r/pullrequest/1'],
    ['ftp', 'ftp://dev.azure.com/acme/p/_git/r/pullrequest/1'],
    ['unknown host', 'https://example.com/acme/p/_git/r/pullrequest/1'],
    ['lookalike suffix host', 'https://dev.azure.com.evil.com/acme/p/_git/r/pullrequest/1'],
    ['lookalike prefix host', 'https://evil-dev.azure.com/acme/p/_git/r/pullrequest/1'],
    ['visualstudio lookalike', 'https://acme.visualstudio.com.evil.com/p/_git/r/pullrequest/1'],
    ['nested subdomain', 'https://a.b.visualstudio.com/p/_git/r/pullrequest/1'],
    ['host only in path', 'https://evil.com/dev.azure.com/acme/p/_git/r/pullrequest/1'],
    ['credentials', 'https://user:pw@dev.azure.com/acme/p/_git/r/pullrequest/1'],
    ['custom port', 'https://dev.azure.com:8443/acme/p/_git/r/pullrequest/1'],
    ['missing id', 'https://dev.azure.com/acme/p/_git/r/pullrequest/'],
    ['non-numeric id', 'https://dev.azure.com/acme/p/_git/r/pullrequest/abc'],
    ['zero id', 'https://dev.azure.com/acme/p/_git/r/pullrequest/0'],
    ['negative id', 'https://dev.azure.com/acme/p/_git/r/pullrequest/-3'],
    ['pullrequests (plural)', 'https://dev.azure.com/acme/p/_git/r/pullrequests/1'],
    ['no _git', 'https://dev.azure.com/acme/p/r/pullrequest/1'],
    ['extra segments', 'https://dev.azure.com/acme/p/_git/r/pullrequest/1/files'],
    ['encoded slash in a name', 'https://dev.azure.com/acme/p%2Fq/_git/r/pullrequest/1'],
    ['bad percent-encoding', 'https://dev.azure.com/acme/%E0%A4%A/_git/r/pullrequest/1'],
    ['dot segment as repo', 'https://dev.azure.com/acme/p/_git/%2E%2E/pullrequest/1'],
    ['no organisation', 'https://dev.azure.com/'],
  ])('rejects %s with a helpful message', (_n, input) => {
    try {
      parsePrUrl(input);
      throw new Error('expected a failure');
    } catch (e) {
      expect(e).toBeInstanceOf(AdoError);
      expect((e as AdoError).kind).toBe('url');
      expect((e as AdoError).message.length).toBeGreaterThan(10);
    }
  });
});

describe('addedMarkdownPaths (change filtering against recorded-shape fixtures)', () => {
  const changes = (id: number, skip = 0) => (JSON.parse(handleAdo({ url: `/acme/Proj%20One/_apis/git/repositories/platform/pullRequests/${id}/iterations/2/changes?$skip=${skip}`, authorization: `Basic ${Buffer.from(`:${PAT}`).toString('base64')}` }).body.toString()) as { changeEntries: never[] }).changeEntries;

  it('keeps only added .md files: not edits, renames, deletes, folders or other extensions', () => {
    expect(addedMarkdownPaths(changes(101))).toEqual(['/docs/arch.md']);
    expect(addedMarkdownPaths(changes(103))).toEqual([]);
  });

  it('treats "add, edit" as added, matches .MD case-insensitively, and sorts', () => {
    expect(addedMarkdownPaths(changes(102))).toEqual(['/docs/a.md', '/docs/guides/b.MD']);
  });

  it('ignores malformed entries, dedupes, and rejects add+delete combinations', () => {
    expect(
      addedMarkdownPaths([
        { changeType: 'add', item: { path: '/a.md' } },
        { changeType: 'add', item: { path: '/a.md' } },
        { changeType: 'add, delete', item: { path: '/gone.md' } },
        { changeType: 'ADD', item: { path: '/Upper.md' } },
        { changeType: 'add' },
        { item: { path: '/nochange.md' } },
        { changeType: 'add', item: { path: '/folder.md', isFolder: true } },
      ]),
    ).toEqual(['/a.md', '/Upper.md']);
  });
});

describe('image references', () => {
  it('extracts relative markdown and HTML image references only', () => {
    const md = [
      '![a](images/a.png)', '![b](./b.png "title")', '![c](https://example.com/c.png)', '![d](/abs/d.png)', '![e](data:image/png;base64,xx)',
      '<img src="img/f.png" alt="f">', "<img alt='g' src='g.png'>", '![h](images/h%20x.png)', '![i](images/i.png?raw=true#frag)', '![dup](images/a.png)',
    ].join('\n');
    expect(extractImageRefs(md).sort()).toEqual(['./b.png', 'g.png', 'images/a.png', 'images/h x.png', 'images/i.png', 'img/f.png'].sort());
  });

  it.each([
    ['images/a.png', 'images/a.png'],
    ['./a.png', 'a.png'],
    ['x/../a.png', 'a.png'],
    ['../a.png', null],
    ['images/../../a.png', null],
    ['/etc/passwd', null],
    ['a\\b.png', null],
    ['C:/x.png', null],
    ['a\u0000b.png', null],
    ['images/', null],
    ['.', null],
  ])('safeRelImage(%j) -> %j', (input, out) => {
    expect(safeRelImage(input)).toBe(out);
  });
});

describe('AdoClient', () => {
  const mk = (id: number, pat = PAT, extra: Partial<Parameters<typeof createAdoClient>[1]> = {}, calls: { url: string; init?: RequestInit }[] = []) =>
    createAdoClient(ref(id), { pat, fetch: mockFetch(calls), ...extra });

  it('finds the single added markdown file at the latest iteration\'s source commit', async () => {
    const r = await mk(101).listAddedMarkdown();
    expect(r).toMatchObject({ files: ['/docs/arch.md'], commit: LATEST_COMMIT, iteration: 2, title: 'Pull request 101: add docs' });
  });

  it('returns several files, or none', async () => {
    expect((await mk(102).listAddedMarkdown()).files).toEqual(['/docs/a.md', '/docs/guides/b.MD']);
    expect((await mk(103).listAddedMarkdown()).files).toEqual([]);
  });

  it('follows pagination of the changes list', async () => {
    const calls: { url: string }[] = [];
    const r = await mk(107, PAT, {}, calls).listAddedMarkdown();
    expect(r.files).toEqual(['/docs/late.md']);
    expect(calls.filter((c) => c.url.includes('/changes')).length).toBe(2);
  });

  it('authenticates with Basic auth, uses the documented endpoints and never follows redirects', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    await mk(101, PAT, {}, calls).listAddedMarkdown();
    expect(calls.length).toBeGreaterThanOrEqual(3);
    for (const c of calls) {
      expect(new Headers(c.init?.headers).get('authorization')).toBe(`Basic ${Buffer.from(`:${PAT}`).toString('base64')}`);
      expect(c.init?.redirect).toBe('manual');
      expect(c.url.startsWith('https://dev.azure.com/acme/Proj%20One/_apis/git/repositories/platform/')).toBe(true);
      expect(c.url).toContain('api-version=7.1');
    }
    expect(calls.some((c) => /\/pullRequests\/101\/iterations\/2\/changes/.test(c.url))).toBe(true);
  });

  it('uses the {org}.visualstudio.com origin for legacy URLs', async () => {
    const calls: { url: string }[] = [];
    const c = createAdoClient({ ...ref(101), legacyHost: true }, { pat: PAT, fetch: mockFetch(calls) });
    await c.getPullRequestTitle();
    expect(calls[0]!.url.startsWith('https://acme.visualstudio.com/Proj%20One/_apis/git/repositories/platform/pullRequests/101')).toBe(true);
  });

  it.each([
    ['wrong token', 101, 'bad-token', 'auth', /rejected the personal access token/],
    ['revoked (401)', 104, PAT, 'auth', /rejected the personal access token/],
    ['sign-in page (203/HTML)', 111, PAT, 'auth', /rejected the personal access token/],
    ['no access (403)', 105, PAT, 'forbidden', /does not have access/],
    ['unknown PR (404)', 999, PAT, 'notfound', /Pull request not found/],
    ['server error (500)', 110, PAT, 'network', /HTTP 500/],
  ] as const)('maps %s to a specific message', async (_n, id, pat, kind, msg) => {
    const err = await mk(id, pat).listAddedMarkdown().catch((e) => e);
    expect(err).toBeInstanceOf(AdoError);
    expect(err.kind).toBe(kind);
    expect(err.message).toMatch(msg);
    expect(err.message).not.toContain(pat); // the token never appears in messages
  });

  it('treats a redirect as an authentication failure', async () => {
    const f = (async () => new Response(null, { status: 302, headers: { location: 'https://login.example.com' } })) as unknown as typeof fetch;
    const err = await createAdoClient(ref(101), { pat: PAT, fetch: f }).getPullRequestTitle().catch((e) => e);
    expect(err.kind).toBe('auth');
  });

  it('reports network failures and timeouts without leaking details', async () => {
    const down = (async () => { throw new TypeError('fetch failed: ECONNREFUSED 10.0.0.1'); }) as unknown as typeof fetch;
    const e1 = await createAdoClient(ref(101), { pat: PAT, fetch: down }).getPullRequestTitle().catch((e) => e);
    expect(e1).toMatchObject({ kind: 'network' });
    expect(e1.message).not.toContain('10.0.0.1');
    const hang = ((_u: string, init?: RequestInit) => new Promise((_r, rej) => init?.signal?.addEventListener('abort', () => rej(init.signal!.reason)))) as unknown as typeof fetch;
    const e2 = await createAdoClient(ref(101), { pat: PAT, fetch: hang, timeoutMs: 30 }).getPullRequestTitle().catch((e) => e);
    expect(e2).toMatchObject({ kind: 'network' });
    expect(e2.message).toMatch(/did not respond in time/);
  });

  it('rejects unexpected response bodies', async () => {
    const f = (async () => new Response('not json', { status: 200, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;
    const err = await createAdoClient(ref(101), { pat: PAT, fetch: f }).getPullRequestTitle().catch((e) => e);
    expect(err.kind).toBe('data');
  });

  it('can be pointed at another API origin (test hook) while keeping the same paths', async () => {
    const calls: { url: string }[] = [];
    await createAdoClient(ref(101), { pat: PAT, fetch: mockFetch(calls), apiBase: 'http://127.0.0.1:4174/' }).getPullRequestTitle();
    expect(calls[0]!.url.startsWith('http://127.0.0.1:4174/acme/Proj%20One/_apis/git/repositories/platform/pullRequests/101')).toBe(true);
  });
});

describe('fetchAdoDocument (file + images at the source commit, cached locally)', () => {
  const cacheRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rt-ado-'));
  const binaryErr = (m: string) => new Error(m);

  it('fetches the markdown and its relative images from the latest source commit and caches them', async () => {
    const calls: { url: string }[] = [];
    const client = createAdoClient(ref(101), { pat: PAT, fetch: mockFetch(calls) });
    const root = cacheRoot();
    const doc = await fetchAdoDocument(client, LATEST_COMMIT, '/docs/arch.md', root, looksBinary, binaryErr);
    expect(doc.name).toBe('arch');
    expect(doc.source).toContain('# Platform Architecture');
    expect(doc.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(doc.sourceKey).toBe('ado:acme/Proj One/platform/101/docs/arch.md');
    expect(doc.label).toContain('PR #101');
    expect(fs.existsSync(path.join(doc.dir, 'images', 'diagram.png'))).toBe(true);
    expect(doc.missingImages.sort()).toEqual(['../secret.png', 'images/missing.png']);
    // every item request used the latest source commit and a path inside the document's directory
    const items = calls.filter((c) => c.url.includes('/items?')).map((c) => new URL(c.url));
    // the markdown, the good image, and the missing image (a 404 from the server); nothing at all for the unsafe "../secret.png"
    expect(items.map((u) => u.searchParams.get('path')).sort()).toEqual(['/docs/arch.md', '/docs/images/diagram.png', '/docs/images/missing.png']);
    expect(items.map((u) => u.searchParams.get('versionDescriptor.version'))).toEqual(Array(items.length).fill(LATEST_COMMIT));
    // nothing was written outside the cache directory
    expect(fs.existsSync(path.join(root, 'secret.png'))).toBe(false);
    expect(fs.existsSync(path.join(path.dirname(doc.dir), 'secret.png'))).toBe(false);
  });

  it('keys the cache by PR, commit and file so different files never collide', () => {
    expect(cacheKey(ref(101), LATEST_COMMIT, '/a.md')).not.toBe(cacheKey(ref(101), LATEST_COMMIT, '/b.md'));
    expect(cacheKey(ref(101), LATEST_COMMIT, '/a.md')).not.toBe(cacheKey(ref(101), 'other', '/a.md'));
    expect(cacheKey(ref(101), LATEST_COMMIT, '/a.md')).toMatch(/^[0-9a-f]{24}$/);
  });

  it('rejects a binary markdown file through the supplied error factory', async () => {
    const client = createAdoClient(ref(108), { pat: PAT, fetch: mockFetch() });
    await expect(fetchAdoDocument(client, LATEST_COMMIT, '/docs/binary.md', cacheRoot(), looksBinary, binaryErr)).rejects.toThrow(/binary or not valid UTF-8/);
  });

  it('does not fetch images with unsafe or unsupported paths', async () => {
    const calls: { url: string }[] = [];
    const evil = ['![a](../../x.png)', '![b](images/../../y.png)', '![c](a\\b.png)', '![d](notes.txt)', '![e](C:/x.png)'].join('\n');
    const fake = ((url: string) => {
      calls.push({ url });
      return Promise.resolve(new Response(evil, { status: 200, headers: { 'content-length': String(evil.length) } }));
    }) as unknown as typeof fetch;
    const client = createAdoClient(ref(101), { pat: PAT, fetch: fake });
    const doc = await fetchAdoDocument(client, LATEST_COMMIT, '/docs/arch.md', cacheRoot(), looksBinary, binaryErr);
    expect(calls).toHaveLength(1); // only the markdown itself
    expect(doc.missingImages).toHaveLength(4); // (the C:/ reference is absolute-looking and ignored)
  });
});
