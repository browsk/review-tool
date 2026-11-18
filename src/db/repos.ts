import { randomUUID } from 'node:crypto';
import type { DB } from './db.js';
import { nowIso } from './db.js';
import { TEXTMODEL_VERSION, type Anchor, type Role, type Scope, type Status } from '../feedback/model.js';

export interface SessionRow {
  id: string;
  sourceKey: string;
  docName: string;
  contentSha256: string;
  lastReviewerId: string | null;
}

export interface ParticipantRow {
  id: string;
  name: string;
  email: string | null;
  role: Role;
}

export interface FeedbackRow {
  id: string;
  scope: Scope;
  status: Status;
  comment: string;
  reviewerId: string;
  reviewerName: string;
  reviewerRole: Role;
  createdAt: string;
  /** milliseconds since the epoch; use for sorting (createdAt only has second resolution) */
  createdEpoch: number;
  updatedAt: string;
  anchor: Anchor | null;
  anchoredSha256: string | null;
}

export class DuplicateParticipantError extends Error {}
export class ParticipantInUseError extends Error {}
export class NotFoundError extends Error {}

type Raw = Record<string, any>;

const toSession = (r: Raw): SessionRow => ({
  id: r.id,
  sourceKey: r.source_key,
  docName: r.doc_name,
  contentSha256: r.content_sha256,
  lastReviewerId: r.last_reviewer_id,
});

const toFeedback = (r: Raw): FeedbackRow => ({
  id: r.id,
  scope: r.scope,
  status: r.status,
  comment: r.comment,
  reviewerId: r.reviewer_id,
  reviewerName: r.reviewer_name,
  reviewerRole: r.reviewer_role,
  createdAt: r.created_at,
  createdEpoch: r.created_epoch,
  updatedAt: r.updated_at,
  anchoredSha256: r.anchored_sha256,
  anchor:
    r.scope === 'range'
      ? {
          start: r.start_offset,
          end: r.end_offset,
          quote: r.quote_exact,
          prefix: r.quote_prefix ?? '',
          suffix: r.quote_suffix ?? '',
          sectionHeading: r.section_heading ?? '',
          kind: r.anchor_kind ?? 'text',
        }
      : null,
});

export function createRepos(db: DB) {
  const fbSelect = `SELECT f.*, p.name AS reviewer_name, p.role AS reviewer_role
                    FROM feedback f JOIN participants p ON p.id = f.reviewer_id`;

  return {
    db,

    /** Resume the session for a document source, or create it. */
    getOrCreateSession(sourceKey: string, docName: string, sha: string) {
      const found = db.prepare('SELECT * FROM sessions WHERE source_key = ?').get(sourceKey) as Raw | undefined;
      if (found) {
        const session = toSession(found);
        return { session, created: false, hashChanged: session.contentSha256 !== sha, previousSha: session.contentSha256 };
      }
      const id = randomUUID();
      const now = nowIso();
      db.prepare('INSERT INTO sessions(id, source_key, doc_name, content_sha256, created_at, updated_at) VALUES (?,?,?,?,?,?)').run(
        id, sourceKey, docName, sha, now, now,
      );
      return {
        session: { id, sourceKey, docName, contentSha256: sha, lastReviewerId: null } as SessionRow,
        created: true,
        hashChanged: false,
        previousSha: sha,
      };
    },

    getSession(id: string): SessionRow | undefined {
      const r = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Raw | undefined;
      return r && toSession(r);
    },

    setLastReviewer(sessionId: string, participantId: string) {
      db.prepare('UPDATE sessions SET last_reviewer_id = ?, updated_at = ? WHERE id = ?').run(participantId, nowIso(), sessionId);
    },

    listParticipants(sessionId: string): ParticipantRow[] {
      return (db.prepare('SELECT id, name, email, role FROM participants WHERE session_id = ? ORDER BY rowid').all(sessionId) as Raw[]).map(
        (r) => ({ id: r.id, name: r.name, email: r.email, role: r.role }),
      );
    },

    addParticipant(sessionId: string, p: { name: string; email?: string | null; role?: Role }): ParticipantRow {
      const id = randomUUID();
      try {
        db.prepare('INSERT INTO participants(id, session_id, name, email, role) VALUES (?,?,?,?,?)').run(
          id, sessionId, p.name.trim(), p.email?.trim() || null, p.role ?? 'reviewer',
        );
      } catch (e) {
        if ((e as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
          throw new DuplicateParticipantError(`A participant named "${p.name.trim()}" already exists.`);
        }
        throw e;
      }
      return { id, name: p.name.trim(), email: p.email?.trim() || null, role: p.role ?? 'reviewer' };
    },

    deleteParticipant(sessionId: string, id: string) {
      try {
        const r = db.prepare('DELETE FROM participants WHERE id = ? AND session_id = ?').run(id, sessionId);
        if (!r.changes) throw new NotFoundError('Participant not found.');
      } catch (e) {
        if (/FOREIGN KEY/i.test((e as Error).message)) {
          throw new ParticipantInUseError('This participant has feedback and cannot be removed.');
        }
        throw e;
      }
    },

    listFeedback(sessionId: string): FeedbackRow[] {
      return (db.prepare(`${fbSelect} WHERE f.session_id = ? ORDER BY f.created_epoch, f.rowid`).all(sessionId) as Raw[]).map(toFeedback);
    },

    getFeedback(sessionId: string, id: string): FeedbackRow | undefined {
      const r = db.prepare(`${fbSelect} WHERE f.session_id = ? AND f.id = ?`).get(sessionId, id) as Raw | undefined;
      return r && toFeedback(r);
    },

    createFeedback(
      sessionId: string,
      v: { scope: Scope; status: Status; comment: string; reviewerId: string; anchor?: Anchor },
      sha: string,
    ): FeedbackRow {
      const id = randomUUID();
      const now = new Date();
      const iso = nowIso(now);
      const a = v.anchor;
      db.prepare(
        `INSERT INTO feedback(id, session_id, scope, status, comment, reviewer_id, created_at, created_epoch, updated_at,
           start_offset, end_offset, quote_exact, quote_prefix, quote_suffix, section_heading, anchor_kind, anchored_sha256, textmodel_version)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        id, sessionId, v.scope, v.status, v.comment, v.reviewerId, iso, now.getTime(), iso,
        a?.start ?? null, a?.end ?? null, a?.quote ?? null, a?.prefix ?? null, a?.suffix ?? null,
        a?.sectionHeading ?? null, a?.kind ?? null, a ? sha : null, a ? TEXTMODEL_VERSION : null,
      );
      this.setLastReviewer(sessionId, v.reviewerId);
      return this.getFeedback(sessionId, id)!;
    },

    updateFeedback(sessionId: string, id: string, v: { status: Status; comment: string; reviewerId: string }): FeedbackRow {
      const r = db
        .prepare('UPDATE feedback SET status = ?, comment = ?, reviewer_id = ?, updated_at = ? WHERE id = ? AND session_id = ?')
        .run(v.status, v.comment, v.reviewerId, nowIso(), id, sessionId);
      if (!r.changes) throw new NotFoundError('Feedback not found.');
      this.setLastReviewer(sessionId, v.reviewerId);
      return this.getFeedback(sessionId, id)!;
    },

    deleteFeedback(sessionId: string, id: string) {
      const r = db.prepare('DELETE FROM feedback WHERE id = ? AND session_id = ?').run(id, sessionId);
      if (!r.changes) throw new NotFoundError('Feedback not found.');
    },

    /** Write back re-anchored offsets and record the document hash they were anchored to. */
    applyReanchor(sessionId: string, updates: { id: string; start: number; end: number }[], sha: string) {
      db.transaction(() => {
        const upd = db.prepare(
          `UPDATE feedback SET start_offset = ?, end_offset = ?, anchored_sha256 = ?, textmodel_version = ?
           WHERE id = ? AND session_id = ? AND scope = 'range' AND ? > ?`,
        );
        for (const u of updates) upd.run(u.start, u.end, sha, TEXTMODEL_VERSION, u.id, sessionId, u.end, u.start);
        db.prepare('UPDATE feedback SET anchored_sha256 = ? WHERE session_id = ? AND scope = \'range\' AND anchored_sha256 IS NOT ?').run(sha, sessionId, sha);
        db.prepare('UPDATE sessions SET content_sha256 = ?, updated_at = ? WHERE id = ?').run(sha, nowIso(), sessionId);
      })();
    },
  };
}

export type Repos = ReturnType<typeof createRepos>;
