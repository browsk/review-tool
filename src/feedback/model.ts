export const STATUSES = ['Reject', 'Accept with conditions', 'Accept'] as const;
export type Status = (typeof STATUSES)[number];
export const SCOPES = ['document', 'range'] as const;
export type Scope = (typeof SCOPES)[number];
export const ROLES = ['author', 'reviewer'] as const;
export type Role = (typeof ROLES)[number];

/** Friendly warning about the author count (exactly one is expected); null when fine. */
export function authorWarning(authors: number): string | null {
  if (authors === 1) return null;
  if (authors === 0) return 'No author is set. Mark one participant as the author so exports show who wrote the document.';
  return `Several authors are set (${authors}); exactly one author is expected.`;
}

/** Higher is more severe: Reject > Accept with conditions > Accept */
export const SEVERITY: Record<Status, number> = { Reject: 3, 'Accept with conditions': 2, Accept: 1 };

/** Bump when the normalised-text algorithm in src/shared/textmodel.ts changes. */
export const TEXTMODEL_VERSION = 1;

export interface Anchor {
  start: number;
  end: number;
  quote: string;
  prefix: string;
  suffix: string;
  sectionHeading: string;
  kind: 'text' | 'diagram';
}

export interface FeedbackInput {
  scope?: unknown;
  status?: unknown;
  comment?: unknown;
  reviewerId?: unknown;
  anchor?: unknown;
}

export interface FeedbackValidation {
  errors: Record<string, string>;
  value?: {
    scope: Scope;
    status: Status;
    comment: string;
    reviewerId: string;
    anchor?: Anchor;
  };
}

export const MAX_COMMENT = 20_000;
export const MAX_QUOTE = 200_000;

const isStatus = (v: unknown): v is Status => typeof v === 'string' && (STATUSES as readonly string[]).includes(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

export function commentRequired(status: Status): boolean {
  return status === 'Reject' || status === 'Accept with conditions';
}

/** Validate a create request. For updates pass partial=true (scope/anchor are not editable). */
export function validateFeedback(input: FeedbackInput, partial = false): FeedbackValidation {
  const errors: Record<string, string> = {};
  const scope = partial ? 'range' : input.scope;
  if (!partial && scope !== 'document' && scope !== 'range') errors.scope = 'Scope must be "document" or "range".';
  if (!isStatus(input.status)) errors.status = 'Status must be Reject, Accept with conditions, or Accept.';
  const comment = typeof input.comment === 'string' ? input.comment : '';
  if (input.comment !== undefined && typeof input.comment !== 'string') errors.comment = 'Comment must be text.';
  if (comment.length > MAX_COMMENT) errors.comment = `Comment is too long (limit ${MAX_COMMENT} characters).`;
  if (isStatus(input.status) && commentRequired(input.status) && !comment.trim()) {
    errors.comment = `A comment is required for "${input.status}".`;
  }
  if (typeof input.reviewerId !== 'string' || !input.reviewerId) errors.reviewerId = 'Please choose a reviewer.';

  let anchor: Anchor | undefined;
  if (!partial && scope === 'range') {
    const a = input.anchor as Record<string, unknown> | undefined;
    if (!a || typeof a !== 'object') {
      errors.anchor = 'Range feedback needs an anchor.';
    } else if (
      !isInt(a.start) ||
      !isInt(a.end) ||
      a.end <= a.start ||
      typeof a.quote !== 'string' ||
      !a.quote ||
      a.quote.length > MAX_QUOTE
    ) {
      errors.anchor = 'Anchor needs integer start/end offsets (end > start) and the quoted text.';
    } else {
      anchor = {
        start: a.start,
        end: a.end,
        quote: a.quote,
        prefix: typeof a.prefix === 'string' ? a.prefix.slice(-32) : '',
        suffix: typeof a.suffix === 'string' ? a.suffix.slice(0, 32) : '',
        sectionHeading: typeof a.sectionHeading === 'string' ? a.sectionHeading : '',
        kind: a.kind === 'diagram' ? 'diagram' : 'text',
      };
    }
  }
  if (!partial && scope === 'document' && input.anchor) errors.anchor = 'Document feedback must not have an anchor.';

  if (Object.keys(errors).length) return { errors };
  return {
    errors,
    value: {
      scope: scope as Scope,
      status: input.status as Status,
      comment,
      reviewerId: input.reviewerId as string,
      anchor,
    },
  };
}
