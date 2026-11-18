import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { ROLES, STATUSES, SCOPES, commentRequired, type Role, type Scope, type Status } from './model.js';
import type { FeedbackRow } from '../db/repos.js';

/** Export columns, in this order (FR10). */
export const COLUMNS = [
  'id', 'document_name', 'document_sha256', 'scope', 'status', 'reviewer', 'reviewer_role', 'created_at', 'updated_at',
  'comment', 'section_heading', 'start_offset', 'end_offset', 'quote_exact', 'quote_prefix', 'quote_suffix',
] as const;

/** Columns that must be present in an import file (the rest are optional). */
export const REQUIRED_COLUMNS = ['id', 'scope', 'status', 'reviewer', 'created_at', 'comment', 'start_offset', 'end_offset', 'quote_exact'] as const;

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 50_000;

// ---- CSV injection guard -------------------------------------------------------------------
// A cell that a spreadsheet could read as a formula (leading = + - @ TAB CR) gets a leading apostrophe.
// A cell that already starts with apostrophes followed by such a character also gets one more, so
// stripping exactly one leading apostrophe on import restores every value losslessly.
const TRIGGER = /^[=+\-@\t\r]/;
const QUOTED_TRIGGER = /^'+[=+\-@\t\r]/;

export function guard(v: string): string {
  return TRIGGER.test(v) || QUOTED_TRIGGER.test(v) ? `'${v}` : v;
}
export function unguard(v: string): string {
  return QUOTED_TRIGGER.test(v) ? v.slice(1) : v;
}

// ---- export --------------------------------------------------------------------------------

export function exportCsv(rows: FeedbackRow[], docName: string, docSha: string): string {
  const records = rows.map((f) => {
    const a = f.anchor;
    return [
      guard(f.id), guard(docName), guard(docSha), f.scope, f.status, guard(f.reviewerName), f.reviewerRole,
      guard(f.createdAt), guard(f.updatedAt), guard(f.comment), guard(a?.sectionHeading ?? ''),
      a ? a.start : '', a ? a.end : '', guard(a?.quote ?? ''), guard(a?.prefix ?? ''), guard(a?.suffix ?? ''),
    ];
  });
  // UTF-8 BOM for Excel; RFC 4180 quoting and CRLF record delimiters
  return `﻿${stringify(records, { header: true, columns: [...COLUMNS], record_delimiter: 'windows' })}`;
}

export function exportFilename(docName: string, now = new Date()): string {
  const safe = docName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^\.+/, '_').trim() || 'document';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${safe}-feedback-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.csv`;
}

// ---- import --------------------------------------------------------------------------------

export interface ImportRow {
  row: number;
  id: string;
  scope: Scope;
  status: Status;
  reviewer: string;
  reviewerRole: Role;
  createdAt: string;
  updatedAt: string;
  comment: string;
  sectionHeading: string;
  start: number | null;
  end: number | null;
  quote: string | null;
  prefix: string;
  suffix: string;
  docSha: string;
}

export interface RowError {
  row: number;
  message: string;
}

export interface ImportParse {
  fatal?: string;
  rows: ImportRow[];
  errors: RowError[];
  totalRows: number;
  /** distinct non-empty document_sha256 values in the file that differ from the loaded document */
  mismatchedShas: string[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const NON_NEG_INT = /^\d+$/;

const validDate = (v: string) => ISO_DATE.test(v) && !Number.isNaN(Date.parse(v));

export function parseImport(content: string, currentSha: string): ImportParse {
  const empty = (fatal: string): ImportParse => ({ fatal, rows: [], errors: [], totalRows: 0, mismatchedShas: [] });
  if (Buffer.byteLength(content) > MAX_IMPORT_BYTES) return empty(`The file is too large (limit ${MAX_IMPORT_BYTES / 1024 / 1024} MB).`);
  if (!content.replace(/^﻿/, '').trim()) return empty('The file is empty.');

  let records: Record<string, string>[];
  try {
    records = parse(content, {
      columns: (h: string[]) => h.map((c) => c.replace(/^﻿/, '').trim().toLowerCase()),
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: false, // comments must round-trip exactly, including leading/trailing spaces
    });
  } catch (e) {
    return empty(`Could not read the CSV: ${(e as Error).message}`);
  }
  // header check (order independent)
  const header = new Set(Object.keys(records[0] ?? {}));
  if (records.length === 0) {
    const first = content.replace(/^﻿/, '').split(/\r?\n/, 1)[0] ?? '';
    for (const c of first.split(',').map((x) => x.trim().toLowerCase())) header.add(c);
  }
  const missing = REQUIRED_COLUMNS.filter((c) => !header.has(c));
  if (missing.length) return empty(`Missing required column${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}.`);
  if (records.length === 0) return empty('The file contains a header but no feedback rows.');
  if (records.length > MAX_IMPORT_ROWS) return empty(`Too many rows (${records.length}; limit ${MAX_IMPORT_ROWS}).`);

  const rows: ImportRow[] = [];
  const errors: RowError[] = [];
  const seen = new Map<string, number>();
  const shas = new Set<string>();

  records.forEach((rec, i) => {
    const rowNo = i + 2; // the header is row 1
    const get = (k: string) => unguard(rec[k] ?? '');
    const problems: string[] = [];

    const id = get('id').trim();
    if (!id) problems.push('id is empty');
    else if (!UUID.test(id)) problems.push(`id "${id}" is not a UUID`);
    else if (seen.has(id.toLowerCase())) problems.push(`duplicate id (first seen on row ${seen.get(id.toLowerCase())})`);

    const scope = get('scope').trim();
    if (!(SCOPES as readonly string[]).includes(scope)) problems.push(`scope "${scope}" must be document or range`);
    const status = get('status').trim();
    if (!(STATUSES as readonly string[]).includes(status)) problems.push(`status "${status}" must be Reject, Accept with conditions, or Accept`);
    const reviewer = get('reviewer').trim();
    if (!reviewer) problems.push('reviewer is empty');
    const roleRaw = get('reviewer_role').trim().toLowerCase();
    if (roleRaw && !(ROLES as readonly string[]).includes(roleRaw)) problems.push(`reviewer_role "${roleRaw}" must be author or reviewer`);
    const comment = get('comment');
    if ((STATUSES as readonly string[]).includes(status) && commentRequired(status as Status) && !comment.trim()) {
      problems.push(`comment is required for "${status}"`);
    }
    const createdAt = get('created_at').trim();
    if (!validDate(createdAt)) problems.push(`created_at "${createdAt}" is not a valid ISO 8601 date`);
    const updatedAt = get('updated_at').trim();
    if (updatedAt && !validDate(updatedAt)) problems.push(`updated_at "${updatedAt}" is not a valid ISO 8601 date`);

    let start: number | null = null;
    let end: number | null = null;
    let quote: string | null = null;
    if (scope === 'range') {
      const s = get('start_offset').trim();
      const e = get('end_offset').trim();
      if (!NON_NEG_INT.test(s)) problems.push('start_offset must be a non-negative integer');
      if (!NON_NEG_INT.test(e)) problems.push('end_offset must be a non-negative integer');
      if (NON_NEG_INT.test(s) && NON_NEG_INT.test(e)) {
        start = Number(s);
        end = Number(e);
        if (end <= start) problems.push('end_offset must be greater than start_offset');
      }
      quote = get('quote_exact');
      if (!quote) problems.push('quote_exact is required for range feedback');
    }

    if (problems.length) {
      errors.push({ row: rowNo, message: problems.join('; ') });
      return;
    }
    seen.set(id.toLowerCase(), rowNo);
    const docSha = get('document_sha256').trim();
    if (docSha && docSha.toLowerCase() !== currentSha.toLowerCase()) shas.add(docSha);
    rows.push({
      row: rowNo,
      id: id.toLowerCase(),
      scope: scope as Scope,
      status: status as Status,
      reviewer,
      reviewerRole: (roleRaw || 'reviewer') as Role,
      createdAt,
      updatedAt: updatedAt || createdAt,
      comment,
      sectionHeading: get('section_heading'),
      start,
      end,
      quote,
      prefix: get('quote_prefix'),
      suffix: get('quote_suffix'),
      docSha,
    });
  });

  return { rows, errors, totalRows: records.length, mismatchedShas: [...shas] };
}

export function summarise(rows: { scope: string; status: string }[]) {
  const byScope: Record<string, number> = { document: 0, range: 0 };
  const byStatus: Record<string, number> = { Reject: 0, 'Accept with conditions': 0, Accept: 0 };
  for (const r of rows) {
    byScope[r.scope] = (byScope[r.scope] ?? 0) + 1;
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  }
  return { byScope, byStatus };
}
