import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { looksBinary } from '../render/pipeline.js';

export const MAX_DOC_BYTES = 5 * 1024 * 1024;
export const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

export class PathError extends Error {
  constructor(message: string, public status: 400 | 403 | 404 = 403) {
    super(message);
  }
}

/**
 * Resolve a request-relative path against baseDir. Throws PathError(403) for anything
 * that could escape: encoded traversal, absolute/UNC/drive paths, NUL, backslashes,
 * ADS colons, and symlinks that resolve outside baseDir. Returns the real file path.
 */
export function resolveSafe(baseDir: string, rel: string): string {
  if (rel.includes('\0')) throw new PathError('Invalid path');
  let decoded = rel;
  try {
    decoded = decodeURIComponent(rel);
  } catch {
    throw new PathError('Invalid path encoding');
  }
  if (decoded.includes('\0') || decoded.includes('\\') || decoded.includes(':')) throw new PathError('Invalid path');
  if (decoded.startsWith('/') || decoded.startsWith('//')) throw new PathError('Absolute paths are not allowed');
  const segments = decoded.split('/');
  if (segments.some((s) => s === '..')) throw new PathError('Path traversal is not allowed');

  const baseReal = fs.realpathSync(baseDir);
  const candidate = path.resolve(baseReal, decoded);
  let real: string;
  try {
    real = fs.realpathSync(candidate);
  } catch {
    // not found: still verify the lexical path is inside, then 404
    const lex = path.relative(baseReal, candidate);
    if (lex.startsWith('..') || path.isAbsolute(lex)) throw new PathError('Path traversal is not allowed');
    throw new PathError('Not found', 404);
  }
  const relToBase = path.relative(baseReal, real);
  if (relToBase === '' || relToBase.startsWith('..') || path.isAbsolute(relToBase)) {
    throw new PathError('Path escapes the document directory');
  }
  if (!fs.statSync(real).isFile()) throw new PathError('Not a file', 404);
  return real;
}

export function assetExists(baseDir: string, rel: string): boolean {
  try {
    resolveSafe(baseDir, rel);
    return true;
  } catch {
    return false;
  }
}

export interface LoadedDoc {
  path: string;
  dir: string;
  name: string;
  source: string;
  sha256: string;
}

/** Path problem: shown as an error; the previously loaded document stays displayed. */
export class LoadError extends Error {}
/** File exists but cannot be read as markdown: shown with a red indicator and a diagnostics entry. */
export class ReadFailure extends Error {
  constructor(message: string, public filePath: string) {
    super(message);
  }
}

export function loadLocalDocument(inputPath: string): LoadedDoc {
  const p = inputPath.trim().replace(/^"(.*)"$/, '$1');
  if (!p) throw new LoadError('Please enter a file path.');
  let real: string;
  try {
    real = fs.realpathSync(path.resolve(p));
  } catch {
    throw new LoadError(`File not found: ${p}`);
  }
  const st = fs.statSync(real);
  if (!st.isFile()) throw new LoadError(`Not a regular file: ${p}`);
  if (st.size > MAX_DOC_BYTES) throw new LoadError(`File is too large (${st.size} bytes; limit ${MAX_DOC_BYTES}).`);
  if (!/\.(md|markdown)$/i.test(real)) throw new ReadFailure(`Not a markdown file (.md expected): ${p}`, real);
  const buf = fs.readFileSync(real);
  if (looksBinary(buf)) throw new ReadFailure(`File is binary or not valid UTF-8: ${p}`, real);
  return {
    path: real,
    dir: path.dirname(real),
    name: path.basename(real).replace(/\.(md|markdown)$/i, ''),
    source: buf.toString('utf8').replace(/^﻿/, ''),
    sha256: createHash('sha256').update(buf).digest('hex'),
  };
}
