import fs from 'node:fs';
import path from 'node:path';

const MAX = 10;

export function readRecent(dataDir: string): string[] {
  try {
    const v = JSON.parse(fs.readFileSync(path.join(dataDir, 'recent.json'), 'utf8'));
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function addRecent(dataDir: string, p: string): void {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    const next = [p, ...readRecent(dataDir).filter((x) => x !== p)].slice(0, MAX);
    fs.writeFileSync(path.join(dataDir, 'recent.json'), JSON.stringify(next));
  } catch {
    /* recent list is best-effort */
  }
}
