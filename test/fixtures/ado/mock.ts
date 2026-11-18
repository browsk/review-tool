/**
 * Mock Azure DevOps REST API, shared by unit tests (as a fake fetch) and Playwright (as a local HTTP server).
 * Shapes follow the real API (git/pullRequests, iterations, changes, items). Nothing here calls the network.
 *
 * Scenarios by pull request id (organisation "acme", project "Proj One", repository "platform", PAT "test-pat-123"):
 *   101 one added .md file (plus an edited .md, an added .ts and a folder); the doc has a good, a missing and an unsafe image
 *   102 several added .md files (one with an upper-case .MD extension) plus an edited .md
 *   103 no added .md files (an edited .md and an added .ts)
 *   104 always 401      105 always 403      110 HTTP 500      111 HTTP 203 with an HTML sign-in page
 *   107 changes are paginated over two requests
 *   108 the added .md file is binary
 *   109 the added .md has Mermaid and D2 diagrams
 *   anything else: 404
 */
export const PAT = 'test-pat-123';
export const LATEST_COMMIT = 'c0ffee0000000000000000000000000000000002';
export const OLD_COMMIT = '0ldc0mm1t000000000000000000000000000000001';

export interface MockRequest {
  method?: string;
  url: string;
  authorization?: string | null;
}
export interface MockResponse {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

const DOC_101 = `---
title: Platform Architecture
---

# Platform Architecture

## 1. Introduction and Goals

The platform is described here. See the picture below.

![good diagram](images/diagram.png)

![missing diagram](images/missing.png)

![escapes the document directory](../secret.png)

## 2. Constraints

Some constraints apply.
`;

const DOC_109 = `# Diagrams from a PR

## 1. Context

\`\`\`mermaid
graph TD
  A[Client] --> B[Gateway]
\`\`\`

\`\`\`d2
client -> gateway: request
gateway -> ledger
\`\`\`
`;

const json = (status: number, data: unknown): MockResponse => ({
  status,
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: Buffer.from(JSON.stringify(data)),
});

const change = (p: string, changeType: string, isFolder = false) => ({ changeType, item: { path: p, isFolder, objectId: 'x' } });

function changesFor(id: number, skip: number): unknown {
  switch (id) {
    case 101:
      return {
        changeEntries: [
          change('/docs', 'add', true),
          change('/docs/arch.md', 'add'),
          change('/docs/images/diagram.png', 'add'),
          change('/README.md', 'edit'),
          change('/src/index.ts', 'add'),
          change('/docs/old.md', 'delete'),
        ],
      };
    case 102:
      return {
        changeEntries: [
          change('/docs/a.md', 'add'),
          change('/docs/guides/b.MD', 'add, edit'),
          change('/c.md', 'edit'),
          change('/docs/notes.txt', 'add'),
        ],
      };
    case 103:
      return { changeEntries: [change('/docs/x.md', 'edit'), change('/src/main.ts', 'add'), change('/docs/y.md', 'rename')] };
    case 107:
      return skip === 0
        ? { changeEntries: [change('/x.ts', 'add'), change('/y.png', 'add')], nextSkip: 2, nextTop: 2 }
        : { changeEntries: [change('/docs/late.md', 'add')] };
    case 108:
      return { changeEntries: [change('/docs/binary.md', 'add')] };
    case 109:
      return { changeEntries: [change('/docs/diagrams.md', 'add')] };
    default:
      return { changeEntries: [] };
  }
}

function fileFor(id: number, p: string): Buffer | null {
  const lower = p.toLowerCase();
  if (id === 101) {
    if (p === '/docs/arch.md') return Buffer.from(DOC_101);
    if (p === '/docs/images/diagram.png') return PNG;
  }
  if (id === 102) {
    if (p === '/docs/a.md') return Buffer.from('# Document A\n\n## 1. One\n\nAlpha text.\n');
    if (lower === '/docs/guides/b.md') return Buffer.from('# Document B\n\n## 1. One\n\nBravo text.\n');
  }
  if (id === 107 && p === '/docs/late.md') return Buffer.from('# Late\n\n## 1. One\n\nFound on page two.\n');
  if (id === 108 && p === '/docs/binary.md') return Buffer.from([0, 1, 2, 255, 254, 0]);
  if (id === 109 && p === '/docs/diagrams.md') return Buffer.from(DOC_109);
  return null;
}

/** Handle one request (method + absolute or origin-relative URL + Authorization header). */
export function handleAdo(req: MockRequest): MockResponse {
  const url = new URL(req.url, 'http://mock.invalid');
  const parts = url.pathname.split('/').filter(Boolean).map((s) => decodeURIComponent(s));
  const m = req.authorization ?? '';
  const expected = `Basic ${Buffer.from(`:${PAT}`).toString('base64')}`;

  // /{org}/{project}/_apis/git/repositories/{repo}/...   (legacy hosts have no {org} segment: it is in the host name)
  const apis = parts.findIndex((p) => p === '_apis');
  if (apis < 1 || parts[apis + 1] !== 'git' || parts[apis + 2] !== 'repositories') return json(404, { message: 'unknown route' });
  const project = parts[apis - 1];
  const repo = parts[apis + 3];
  const rest = parts.slice(apis + 4).map((s) => s.toLowerCase());
  const restRaw = parts.slice(apis + 4);

  if (rest[0] === 'pullrequests') {
    const id = Number(restRaw[1]);
    if (id === 111) return { status: 203, headers: { 'content-type': 'text/html' }, body: Buffer.from('<html><title>Sign in</title></html>') };
    if (id === 104 || m !== expected) return json(401, { message: 'TF400813: The user is not authorized to access this resource.' });
    if (id === 105) return json(403, { message: 'TF401019: no access' });
    if (id === 110) return json(500, { message: 'boom' });
    if (project !== 'Proj One' || repo !== 'platform' || ![101, 102, 103, 107, 108, 109].includes(id)) return json(404, { message: 'TF401180: The requested pull request was not found.' });

    if (rest.length === 2) return json(200, { pullRequestId: id, title: `Pull request ${id}: add docs`, status: 'active' });
    if (rest[2] === 'iterations' && rest.length === 3) {
      return json(200, {
        count: 2,
        value: [
          { id: 1, sourceRefCommit: { commitId: OLD_COMMIT } },
          { id: 2, sourceRefCommit: { commitId: LATEST_COMMIT } },
        ],
      });
    }
    if (rest[2] === 'iterations' && rest[4] === 'changes') {
      if (restRaw[3] !== '2') return json(404, { message: 'no such iteration' }); // only the latest iteration is meaningful
      return json(200, changesFor(id, Number(url.searchParams.get('$skip') ?? 0)));
    }
    return json(404, { message: 'unknown pull request route' });
  }

  if (rest[0] === 'items') {
    if (m !== expected) return json(401, { message: 'unauthorized' });
    if (project !== 'Proj One' || repo !== 'platform') return json(404, { message: 'repo not found' });
    // the items endpoint is not keyed by PR; the commit is: only the latest source commit has the files
    const version = url.searchParams.get('versionDescriptor.version');
    const p = url.searchParams.get('path') ?? '';
    if (version !== LATEST_COMMIT) return json(404, { message: `item not found at ${version}` });
    for (const id of [101, 102, 107, 108, 109]) {
      const f = fileFor(id, p);
      if (f) return { status: 200, headers: { 'content-type': 'application/octet-stream', 'content-length': String(f.length) }, body: f };
    }
    return json(404, { message: `TF401174: The item ${p} could not be found` });
  }
  return json(404, { message: 'unknown route' });
}

/** A fetch() implementation backed by the mock, for unit tests. Records requests in `calls`. */
export function mockFetch(calls: { url: string; init?: RequestInit }[] = []): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const headers = new Headers(init?.headers);
    const r = handleAdo({ url, authorization: headers.get('authorization') });
    return new Response(r.body.length ? new Uint8Array(r.body) : null, { status: r.status, headers: r.headers });
  }) as typeof fetch;
}
