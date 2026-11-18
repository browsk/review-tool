import fs from 'node:fs';
import path from 'node:path';

const KEEP = 20;

/** Write an automatic backup export before a destructive import. Throws if it cannot be written. */
export function writeBackup(dataDir: string, baseName: string, csv: string, now = new Date()): string {
  const dir = path.join(dataDir, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const safe = baseName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_') || 'document';
  const file = path.join(dir, `${safe}-backup-${stamp}.csv`);
  fs.writeFileSync(file, csv, { encoding: 'utf8', flag: 'wx' });
  // keep only the most recent backups
  const all = fs.readdirSync(dir).filter((f) => f.endsWith('.csv')).map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }));
  all.sort((a, b) => b.t - a.t);
  for (const old of all.slice(KEEP)) {
    try {
      fs.unlinkSync(path.join(dir, old.f));
    } catch {
      /* best effort */
    }
  }
  return file;
}
