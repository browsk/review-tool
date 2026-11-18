import { api } from './api.js';
import type { Status } from '../src/feedback/model.js';

export interface Participant {
  id: string;
  name: string;
  email: string | null;
  role: 'author' | 'reviewer';
}

export interface FeedbackItem {
  id: string;
  scope: 'document' | 'range';
  status: Status;
  comment: string;
  reviewerId: string;
  reviewerName: string;
  reviewerRole: 'author' | 'reviewer';
  createdAt: string;
  createdEpoch: number;
  updatedAt: string;
  anchor: { start: number; end: number; quote: string; prefix: string; suffix: string; sectionHeading: string; kind: 'text' | 'diagram' } | null;
}

export interface Resolved {
  start: number;
  end: number;
}

class Store extends EventTarget {
  sha256 = '';
  docName = '';
  lastReviewerId: string | null = null;
  needsReanchor = false;
  participants: Participant[] = [];
  feedback: FeedbackItem[] = [];
  /** re-attached positions for range feedback; missing id = orphaned */
  resolved = new Map<string, Resolved>();
  ready = false;

  changed(): void {
    this.dispatchEvent(new Event('change'));
  }

  async load(): Promise<boolean> {
    const r = await api('GET', '/api/state');
    if (!r.ok) return false;
    this.sha256 = r.data.session.sha256;
    this.docName = r.data.session.docName;
    this.lastReviewerId = r.data.session.lastReviewerId;
    this.needsReanchor = !!r.data.needsReanchor;
    this.participants = r.data.participants;
    this.feedback = r.data.feedback;
    this.ready = true;
    return true;
  }

  setParticipants(p: Participant[]): void {
    this.participants = p;
    this.changed();
  }

  upsert(item: FeedbackItem, resolved?: Resolved): void {
    const i = this.feedback.findIndex((f) => f.id === item.id);
    if (i >= 0) this.feedback[i] = item;
    else this.feedback.push(item);
    if (resolved) this.resolved.set(item.id, resolved);
    else if (item.anchor && !this.resolved.has(item.id)) this.resolved.set(item.id, { start: item.anchor.start, end: item.anchor.end });
    this.lastReviewerId = item.reviewerId;
    this.changed();
  }

  remove(id: string): void {
    this.feedback = this.feedback.filter((f) => f.id !== id);
    this.resolved.delete(id);
    this.changed();
  }

  rangeItems(): FeedbackItem[] {
    return this.feedback.filter((f) => f.scope === 'range');
  }
  orphans(): FeedbackItem[] {
    return this.rangeItems().filter((f) => !this.resolved.has(f.id));
  }
}

export const store = new Store();
