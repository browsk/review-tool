import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export type DB = Database.Database;

const MIGRATIONS: string[] = [
  /* v1 */ `
  CREATE TABLE sessions(
    id TEXT PRIMARY KEY,
    source_key TEXT NOT NULL UNIQUE,
    doc_name TEXT NOT NULL,
    content_sha256 TEXT NOT NULL,
    last_reviewer_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE participants(
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL COLLATE NOCASE,
    email TEXT,
    role TEXT NOT NULL CHECK(role IN ('author','reviewer')),
    UNIQUE(session_id, name)
  );
  CREATE INDEX idx_participants_session ON participants(session_id);
  CREATE TABLE feedback(
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    scope TEXT NOT NULL CHECK(scope IN ('document','range')),
    status TEXT NOT NULL CHECK(status IN ('Reject','Accept with conditions','Accept')),
    comment TEXT NOT NULL DEFAULT '',
    reviewer_id TEXT NOT NULL REFERENCES participants(id) ON DELETE RESTRICT,
    created_at TEXT NOT NULL,
    created_epoch INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    start_offset INTEGER,
    end_offset INTEGER,
    quote_exact TEXT,
    quote_prefix TEXT,
    quote_suffix TEXT,
    section_heading TEXT,
    anchor_kind TEXT CHECK(anchor_kind IN ('text','diagram')),
    anchored_sha256 TEXT,
    textmodel_version INTEGER,
    CHECK(
      (scope = 'document' AND start_offset IS NULL AND end_offset IS NULL) OR
      (scope = 'range' AND start_offset IS NOT NULL AND end_offset IS NOT NULL
        AND end_offset > start_offset AND quote_exact IS NOT NULL)
    )
  );
  CREATE INDEX idx_feedback_session ON feedback(session_id);
  `,
];

export function migrate(db: DB): void {
  const current = db.pragma('user_version', { simple: true }) as number;
  if (current > MIGRATIONS.length) {
    throw new Error(`Database schema v${current} is newer than this app supports (v${MIGRATIONS.length}). Update the app.`);
  }
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v] as string);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
}

export function openDb(dataDir: string, file = 'review.db'): DB {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, file));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrate(db);
  return db;
}

/** ISO 8601 with the local timezone offset, e.g. 2026-11-18T15:47:35+10:00 */
export function nowIso(d = new Date()): string {
  const pad = (n: number, w = 2) => String(Math.abs(n)).padStart(w, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`
  );
}
