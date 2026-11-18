import { describe, expect, it } from 'vitest';
import { parse } from 'csv-parse/sync';
import { COLUMNS, MAX_IMPORT_ROWS, exportCsv, exportFilename, guard, parseImport, unguard } from '../../src/feedback/csv.js';
import type { FeedbackRow } from '../../src/db/repos.js';

const SHA = 'a'.repeat(64);
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function fb(n: number, o: Partial<FeedbackRow> = {}): FeedbackRow {
  return {
    id: uuid(n),
    scope: 'range',
    status: 'Reject',
    comment: `comment ${n}`,
    reviewerId: 'p1',
    reviewerName: 'Ada Lovelace',
    reviewerRole: 'author',
    createdAt: '2026-11-18T15:47:35+10:00',
    createdEpoch: 1,
    updatedAt: '2026-11-18T16:00:00+10:00',
    anchoredSha256: SHA,
    anchor: { start: 10, end: 25, quote: 'quoted text', prefix: 'before ', suffix: ' after', sectionHeading: '1. Intro', kind: 'text' },
    ...o,
  };
}

const roundTrip = (rows: FeedbackRow[]) => parseImport(exportCsv(rows, 'doc', SHA), SHA);

describe('CSV export', () => {
  it('has the exact columns in the required order, a BOM, CRLF records and a header row', () => {
    const csv = exportCsv([fb(1)], 'My Doc', SHA);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const header = csv.slice(1).split('\r\n')[0];
    expect(header).toBe(
      'id,document_name,document_sha256,scope,status,reviewer,reviewer_role,created_at,updated_at,comment,section_heading,start_offset,end_offset,quote_exact,quote_prefix,quote_suffix',
    );
    expect([...COLUMNS]).toEqual(header!.split(','));
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('quotes every field containing a line break (a bare LF must not be left unquoted for Excel)', () => {
    const csv = exportCsv([fb(1, { comment: 'a\nb', anchor: { start: 1, end: 9, quote: 'x\ny', prefix: 'p\rq', suffix: 's\r\nt', sectionHeading: 'H', kind: 'text' } })], 'd', SHA);
    expect(csv).toContain('"a\nb"');
    expect(csv).toContain('"x\ny"');
    expect(csv).toContain('"p\rq"');
    expect(csv).toContain('"s\r\nt"');
  });

  it('leaves range-only columns empty for document rows', () => {
    const csv = exportCsv([fb(1, { scope: 'document', anchor: null, status: 'Accept', comment: '' })], 'd', SHA);
    const [rec] = parse(csv, { columns: true, bom: true }) as Record<string, string>[];
    expect(rec).toMatchObject({ scope: 'document', section_heading: '', start_offset: '', end_offset: '', quote_exact: '', quote_prefix: '', quote_suffix: '' });
    expect(rec!.document_name).toBe('d');
    expect(rec!.document_sha256).toBe(SHA);
  });

  it('builds <name>-feedback-<yyyymmdd-hhmm>.csv and sanitises illegal filename characters', () => {
    expect(exportFilename('arc42', new Date(2026, 10, 18, 9, 5))).toBe('arc42-feedback-20261118-0905.csv');
    expect(exportFilename('a/b:c*d?.md', new Date(2026, 0, 2, 3, 4))).toBe('a_b_c_d_.md-feedback-20260102-0304.csv');
    expect(exportFilename('', new Date(2026, 0, 2, 3, 4))).toMatch(/^document-feedback-/);
  });
});

describe('special characters round-trip exactly', () => {
  const nasty = [
    'plain',
    'with, comma',
    'with "quotes" and ""double""',
    'line one\nline two',
    'crlf one\r\ncrlf two',
    '  leading and trailing spaces  ',
    'unicode: café über 日本語 😀 — “smart”',
    ',\n"\r\n,',
    ' nbsp',
    'ends with backslash\\',
  ];
  it.each(nasty)('comment and quotes survive: %j', (s) => {
    const r = roundTrip([fb(1, { status: 'Accept', comment: s, anchor: { start: 1, end: 5, quote: `q:${s}`, prefix: s, suffix: s, sectionHeading: s, kind: 'text' }, reviewerName: `R ${s}` })]);
    expect(r.errors).toEqual([]);
    const row = r.rows[0]!;
    expect(row.comment).toBe(s);
    expect(row.quote).toBe(`q:${s}`);
    expect(row.prefix).toBe(s);
    expect(row.suffix).toBe(s);
    expect(row.sectionHeading).toBe(s);
    expect(row.reviewer).toBe(`R ${s}`.trim());
  });

  it('round-trips ids, dates, statuses, scopes, offsets and roles', () => {
    const rows = [fb(1), fb(2, { scope: 'document', anchor: null, status: 'Accept with conditions', comment: 'c', reviewerRole: 'reviewer' }), fb(3, { status: 'Accept', comment: '' })];
    const r = roundTrip(rows);
    expect(r.errors).toEqual([]);
    expect(r.rows.map((x) => [x.id, x.scope, x.status, x.createdAt, x.updatedAt, x.start, x.end, x.reviewerRole])).toEqual(
      rows.map((x) => [x.id, x.scope, x.status, x.createdAt, x.updatedAt, x.anchor?.start ?? null, x.anchor?.end ?? null, x.reviewerRole]),
    );
  });

  it('survives randomised strings (property-style)', () => {
    const alphabet = ['=', '+', '-', '@', "'", '"', ',', '\n', '\r', '\t', ' ', 'a', 'Z', '0', 'é', '😀', '\\'];
    let seed = 12345;
    const rand = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 300; i++) {
      const len = Math.floor(rand() * 12) + 1;
      const s = Array.from({ length: len }, () => alphabet[Math.floor(rand() * alphabet.length)]).join('');
      // Accept: a whitespace-only comment is legitimate here (it would be rejected for Reject)
      const r = roundTrip([fb(1, { status: 'Accept', comment: s, anchor: { start: 0, end: 3, quote: s || 'x', prefix: s, suffix: s, sectionHeading: s, kind: 'text' } })]);
      const row = r.rows[0];
      expect(row, JSON.stringify(s)).toBeDefined();
      expect(row!.comment, JSON.stringify(s)).toBe(s);
      expect(row!.quote).toBe(s || 'x');
      expect(row!.prefix).toBe(s);
      expect(row!.suffix).toBe(s);
    }
  });
});

describe('CSV injection guard', () => {
  it.each(['=', '+', '-', '@', '\t', '\r'])('prefixes a cell starting with %j and strips it on import', (ch) => {
    const v = `${ch}SUM(A1:A9)`;
    expect(guard(v)).toBe(`'${v}`);
    expect(unguard(guard(v))).toBe(v);
    const csv = exportCsv([fb(1, { comment: v })], 'd', SHA);
    const [rec] = parse(csv, { columns: true, bom: true }) as Record<string, string>[];
    expect(rec!.comment!.startsWith("'")).toBe(true); // what a spreadsheet would see
    expect(roundTrip([fb(1, { comment: v })]).rows[0]!.comment).toBe(v);
  });

  it('applies to every text column, not just comments', () => {
    const csv = exportCsv(
      [fb(1, { reviewerName: '=cmd()', anchor: { start: 0, end: 3, quote: '+quote', prefix: '-pre', suffix: '@suf', sectionHeading: '=head', kind: 'text' } })],
      '=docname',
      SHA,
    );
    const [rec] = parse(csv, { columns: true, bom: true }) as Record<string, string>[];
    for (const col of ['reviewer', 'quote_exact', 'quote_prefix', 'quote_suffix', 'section_heading', 'document_name']) {
      expect(rec![col]!.startsWith("'"), col).toBe(true);
    }
  });

  it('keeps a genuine leading apostrophe and double-prefixes apostrophe+trigger so import is lossless', () => {
    expect(guard("'tis")).toBe("'tis"); // not a trigger: unchanged
    expect(unguard("'tis")).toBe("'tis");
    expect(guard("'=x")).toBe("''=x");
    expect(unguard("''=x")).toBe("'=x");
    expect(guard("''-5")).toBe("'''-5");
    expect(unguard("'''-5")).toBe("''-5");
    for (const v of ["'tis", "'=x", "''=x", "'-5", "=x", 'plain', '', "'", "''"]) expect(unguard(guard(v))).toBe(v);
  });

  it('does not alter numeric offsets', () => {
    const csv = exportCsv([fb(1)], 'd', SHA);
    const [rec] = parse(csv, { columns: true, bom: true }) as Record<string, string>[];
    expect(rec!.start_offset).toBe('10');
    expect(rec!.end_offset).toBe('25');
  });
});

describe('CSV import validation', () => {
  const H = 'id,scope,status,reviewer,created_at,comment,start_offset,end_offset,quote_exact';
  const good = (n: number) => `${uuid(n)},range,Reject,Ada,2026-11-18T10:00:00+10:00,because,1,5,quote`;
  const parseRows = (...lines: string[]) => parseImport(lines.join('\r\n'), SHA);

  it('accepts a minimal file with only the required columns, in any order', () => {
    const r = parseRows('quote_exact,end_offset,start_offset,comment,created_at,reviewer,status,scope,id', `quote,5,1,because,2026-11-18,Ada,Reject,range,${uuid(1)}`);
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ start: 1, end: 5, quote: 'quote', status: 'Reject', reviewerRole: 'reviewer', updatedAt: '2026-11-18' });
  });

  it('ignores extra columns and tolerates a BOM, CRLF and header case/whitespace', () => {
    const r = parseImport(`﻿ ID , Scope,STATUS,reviewer,created_at,comment,start_offset,end_offset,quote_exact,extra\r\n${good(1)},ignored\r\n`, SHA);
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(1);
  });

  it('rejects the whole file for missing required columns, naming them', () => {
    expect(parseImport('id,scope\r\n1,document', SHA).fatal).toMatch(/Missing required columns: status, reviewer, created_at, comment, start_offset, end_offset, quote_exact/);
    expect(parseImport('scope,status\r\n', SHA).fatal).toMatch(/Missing required columns: id/);
  });

  it('rejects empty files, header-only files and unreadable CSV', () => {
    expect(parseImport('', SHA).fatal).toMatch(/empty/);
    expect(parseImport(`${H}\r\n`, SHA).fatal).toMatch(/no feedback rows/);
    expect(parseImport(`${H}\r\n"unterminated`, SHA).fatal).toMatch(/Could not read the CSV/);
  });

  it('enforces size and row limits', () => {
    const many = [H, ...Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `${uuid(i)},document,Accept,A,2026-01-01,,,,`)].join('\n');
    expect(parseImport(many, SHA).fatal).toMatch(/Too many rows/);
    expect(parseImport('x'.repeat(11 * 1024 * 1024), SHA).fatal).toMatch(/too large/);
  });

  const cases: [string, string, RegExp][] = [
    ['empty id', `,range,Reject,Ada,2026-11-18,because,1,5,quote`, /id is empty/],
    ['non-UUID id', `not-a-uuid,range,Reject,Ada,2026-11-18,because,1,5,quote`, /not a UUID/],
    ['bad scope', `${uuid(1)},page,Reject,Ada,2026-11-18,because,1,5,quote`, /scope "page"/],
    ['bad status', `${uuid(1)},range,Maybe,Ada,2026-11-18,because,1,5,quote`, /status "Maybe"/],
    ['empty reviewer', `${uuid(1)},range,Reject,,2026-11-18,because,1,5,quote`, /reviewer is empty/],
    ['bad role', `${uuid(1)},range,Reject,Ada,2026-11-18,because,1,5,quote`.replace('Ada', 'Ada') , /$^/],
    ['bad date', `${uuid(1)},range,Reject,Ada,yesterday,because,1,5,quote`, /created_at "yesterday"/],
    ['numeric-only date', `${uuid(1)},range,Reject,Ada,1,because,1,5,quote`, /created_at "1"/],
    ['Reject without comment', `${uuid(1)},range,Reject,Ada,2026-11-18, ,1,5,quote`, /comment is required for "Reject"/],
    ['conditions without comment', `${uuid(1)},range,Accept with conditions,Ada,2026-11-18,,1,5,quote`, /comment is required for "Accept with conditions"/],
    ['non-integer start', `${uuid(1)},range,Accept,Ada,2026-11-18,,1.5,5,quote`, /start_offset must be a non-negative integer/],
    ['negative start', `${uuid(1)},range,Accept,Ada,2026-11-18,,-1,5,quote`, /start_offset/],
    ['missing end', `${uuid(1)},range,Accept,Ada,2026-11-18,,1,,quote`, /end_offset must be a non-negative integer/],
    ['end not after start', `${uuid(1)},range,Accept,Ada,2026-11-18,,5,5,quote`, /end_offset must be greater than start_offset/],
    ['range without quote', `${uuid(1)},range,Accept,Ada,2026-11-18,,1,5,`, /quote_exact is required/],
  ];
  it.each(cases.filter(([n]) => n !== 'bad role'))('skips a row with %s and reports the reason', (_n, line, re) => {
    const r = parseRows(H, line, good(9));
    expect(r.rows.map((x) => x.id)).toEqual([uuid(9)]); // valid rows still import
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]!.row).toBe(2);
    expect(r.errors[0]!.message).toMatch(re);
  });

  it('validates reviewer_role and updated_at when present', () => {
    const r = parseImport(`${H},reviewer_role,updated_at\r\n${good(1)},boss,2026-11-18\r\n${good(2)},author,nonsense\r\n${good(3)},Author,2026-11-19\r\n`, SHA);
    expect(r.errors.map((e) => [e.row, e.message.split(' ')[0]])).toEqual([[2, 'reviewer_role'], [3, 'updated_at']]);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.reviewerRole).toBe('author');
  });

  it('reports duplicate ids within the file and keeps the first', () => {
    const r = parseRows(H, good(1), good(1), good(2));
    expect(r.rows.map((x) => x.id)).toEqual([uuid(1), uuid(2)]);
    expect(r.errors).toEqual([{ row: 3, message: 'duplicate id (first seen on row 2)' }]);
  });

  it('ignores stray range fields on document rows', () => {
    const r = parseRows(H, `${uuid(1)},document,Accept,Ada,2026-11-18,,abc,-3,stray`);
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ scope: 'document', start: null, end: null, quote: null });
  });

  it('lists every problem on a row and numbers rows from the header (row 1)', () => {
    const r = parseRows(H, good(1), `x,page,Maybe,,nope,,a,b,`);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]!.row).toBe(3);
    expect(r.errors[0]!.message.split('; ').length).toBeGreaterThanOrEqual(5);
  });

  it('imports nothing when every row is invalid', () => {
    const r = parseRows(H, `bad,range,Reject,Ada,2026-11-18,because,1,5,quote`, `bad2,page,Accept,Ada,2026-11-18,,1,5,quote`);
    expect(r.rows).toEqual([]);
    expect(r.errors).toHaveLength(2);
    expect(r.totalRows).toBe(2);
  });

  it('flags a document_sha256 that differs from the loaded document', () => {
    const csv = (sha: string) => `${H},document_sha256\r\n${good(1)},${sha}\r\n`;
    expect(parseImport(csv(SHA), SHA).mismatchedShas).toEqual([]);
    expect(parseImport(csv(SHA.toUpperCase()), SHA).mismatchedShas).toEqual([]);
    expect(parseImport(csv('b'.repeat(64)), SHA).mismatchedShas).toEqual(['b'.repeat(64)]);
    expect(parseImport(`${H}\r\n${good(1)}\r\n`, SHA).mismatchedShas).toEqual([]); // no hash column: no warning
  });

  it('lowercases ids so import is case-insensitive about UUIDs', () => {
    const r = parseRows(H, good(1).replace(uuid(1), uuid(1).toUpperCase().replace(/X/g, 'x')));
    expect(r.rows[0]!.id).toBe(uuid(1));
  });
});

import { inferKind } from '../../src/feedback/csv.js';

describe('diagram anchors in CSV', () => {
  it('infers a diagram anchor: it covers one character but its quote is the (longer) diagram source', () => {
    expect(inferKind(40, 41, 'graph TD\n  A --> B')).toBe('diagram');
    expect(inferKind(40, 41, 'a -> b')).toBe('diagram');
    expect(inferKind(10, 25, 'ordinary quoted text')).toBe('text');
    expect(inferKind(10, 11, 'x')).toBe('text'); // a one-character text selection
    expect(inferKind(null, null, null)).toBe('text');
  });

  it('puts the inferred kind on imported rows', () => {
    const H = 'id,scope,status,reviewer,created_at,comment,start_offset,end_offset,quote_exact';
    const r = parseImport(`${H}\r\n${uuid(1)},range,Accept,Ada,2026-11-18,,40,41,"graph TD\n  A --> B"\r\n${uuid(2)},range,Accept,Ada,2026-11-18,,5,10,hello\r\n${uuid(3)},document,Accept,Ada,2026-11-18,,,,\r\n`, 'x');
    expect(r.errors).toEqual([]);
    expect(r.rows.map((x) => x.kind)).toEqual(['diagram', 'text', 'text']);
  });
});
