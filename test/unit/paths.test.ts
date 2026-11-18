import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { resolveSafe, PathError, loadLocalDocument, LoadError, ReadFailure } from '../../src/sources/local.js';

let root: string;
let docs: string;
let canSymlink = true;

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'rt-paths-'));
  docs = path.join(root, 'docs');
  fs.mkdirSync(path.join(docs, 'images'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs-evil'));
  fs.writeFileSync(path.join(docs, 'images', 'a.png'), 'x');
  fs.writeFileSync(path.join(root, 'secret.txt'), 'secret');
  fs.writeFileSync(path.join(root, 'docs-evil', 'x.png'), 'evil');
  try {
    fs.symlinkSync(path.join(root, 'secret.txt'), path.join(docs, 'link.png'));
  } catch {
    canSymlink = false;
  }
});
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

const status = (fn: () => unknown) => {
  try {
    fn();
    return 200;
  } catch (e) {
    return e instanceof PathError ? e.status : -1;
  }
};

describe('resolveSafe', () => {
  it('serves a file inside the directory', () => {
    expect(fs.existsSync(resolveSafe(docs, 'images/a.png'))).toBe(true);
  });

  it.each([
    '../secret.txt',
    '../../etc/passwd',
    'images/../../secret.txt',
    '%2e%2e/secret.txt',
    '%2e%2e%2fsecret.txt',
    '..%5csecret.txt',
    '..\\secret.txt',
    '/etc/passwd',
    '//server/share/x',
    'C:/Windows/win.ini',
    'C:\\Windows\\win.ini',
    'images/a.png\0.txt',
    'images/a.png:stream',
    '../docs-evil/x.png',
  ])('rejects %s with 403', (p) => {
    expect(status(() => resolveSafe(docs, p))).toBe(403);
  });

  it('does not treat a sibling directory with a shared prefix as inside', () => {
    expect(status(() => resolveSafe(docs, '../docs-evil/x.png'))).toBe(403);
  });

  it('returns 404 for a missing in-directory file', () => {
    expect(status(() => resolveSafe(docs, 'images/missing.png'))).toBe(404);
  });

  it('rejects directories', () => {
    expect(status(() => resolveSafe(docs, 'images'))).toBe(404);
  });

  it('rejects symlinks that escape the directory', (ctx) => {
    if (!canSymlink) return ctx.skip();
    expect(status(() => resolveSafe(docs, 'link.png'))).toBe(403);
  });
});

describe('loadLocalDocument', () => {
  const fx = (n: string) => path.resolve('test/fixtures', n);
  it('loads a valid document with sha256', () => {
    const d = loadLocalDocument(fx('arc42-good.md'));
    expect(d.name).toBe('arc42-good');
    expect(d.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
  it('rejects a missing path with LoadError', () => {
    expect(() => loadLocalDocument(fx('nope.md'))).toThrow(LoadError);
    expect(() => loadLocalDocument('')).toThrow(LoadError);
  });
  it('reports non-markdown and binary files as ReadFailure', () => {
    expect(() => loadLocalDocument(fx('notes.txt'))).toThrow(ReadFailure);
    expect(() => loadLocalDocument(fx('binary.md'))).toThrow(ReadFailure);
  });
});
