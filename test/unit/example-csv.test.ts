import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COLUMNS, parseImport } from '../../src/feedback/csv.js';

describe('examples/feedback-example.csv (documented in docs/CSV_FORMAT.md)', () => {
  const text = fs.readFileSync('examples/feedback-example.csv', 'utf8');
  const doc = fs.readFileSync('docs/CSV_FORMAT.md', 'utf8');

  it('uses the documented columns in the documented order', () => {
    expect(text.split(/\r?\n/)[0]).toBe(COLUMNS.join(','));
    expect(doc).toContain(COLUMNS.join(','));
  });

  it('imports without errors and shows the documented guard, quoting and multi-line comment', () => {
    const r = parseImport(text, 'a'.repeat(64));
    expect(r.fatal).toBeUndefined();
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(3);
    expect(r.rows.map((x) => [x.scope, x.status, x.reviewerRole])).toEqual([
      ['document', 'Accept with conditions', 'reviewer'],
      ['range', 'Reject', 'reviewer'],
      ['range', 'Accept', 'author'],
    ]);
    expect(r.rows[1]!.comment).toBe('The target of "99.99% availability" is not backed by a measurement.\nWhere does the number come from?');
    expect(r.rows[2]!.comment).toBe('=Acknowledged - will add a runbook link'); // guard stripped
    expect(r.mismatchedShas).toHaveLength(1); // the example hash is not the hash of any real document
  });

  it('documents every validation message that the importer can produce', () => {
    for (const m of ['id is empty', 'is not a UUID', 'duplicate id', 'must be document or range', 'comment is required', 'is not a valid ISO 8601 date', 'start_offset must be a non-negative integer', 'end_offset must be greater than start_offset', 'quote_exact is required']) {
      expect(doc, m).toContain(m);
    }
  });
});
