import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { test, expect } from './fixtures.js';
import type { Page } from '@playwright/test';
import { addFeedbackViaDialog, highlightInfo, loadCopy, loadPath, copyDoc, reload, seedParticipants, selectText } from './helpers.js';

const PEOPLE = [{ name: 'Ada', role: 'author' as const }, { name: 'Bob' }, { name: 'Cy' }];
const Q1 = 'Paragraph 2 of section 1.1.';
const Q2 = 'Paragraph 3 of section 3.2.';
const HEADER = 'id,document_name,document_sha256,scope,status,reviewer,reviewer_role,created_at,updated_at,comment,section_heading,start_offset,end_offset,quote_exact,quote_prefix,quote_suffix';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rt-m4-'));
const dataDir = () => process.env.RT_E2E_DATA_DIR!;

async function addDocFeedback(page: Page, v: { reviewer: string; status: 'Reject' | 'Accept with conditions' | 'Accept'; comment?: string }) {
  if (!(await page.locator('#add-doc-feedback').isVisible())) await page.click('#btn-doc-feedback');
  await page.click('#add-doc-feedback');
  const dlg = page.locator('#fb-dialog');
  await expect(dlg).toBeVisible();
  const opts = await page.locator('#fb-reviewer option').allTextContents();
  await page.selectOption('#fb-reviewer', { index: opts.findIndex((o) => o.startsWith(`${v.reviewer} (`)) });
  await dlg.getByLabel(v.status, { exact: true }).check();
  if (v.comment !== undefined) await page.fill('#fb-comment', v.comment);
  await page.click('#fb-save');
  await expect(dlg).toBeHidden();
}

async function exportCsv(page: Page): Promise<{ file: string; name: string; bytes: Buffer }> {
  if (!(await page.locator('#export-link').isVisible())) await page.click('#btn-all-feedback');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export-link')]);
  const file = path.join(tmpDir(), dl.suggestedFilename());
  await dl.saveAs(file);
  return { file, name: dl.suggestedFilename(), bytes: fs.readFileSync(file) };
}

async function openImport(page: Page, file: string) {
  if (!(await page.locator('#import-file').count())) await page.click('#btn-all-feedback');
  await page.setInputFiles('#import-file', file);
  await expect(page.locator('#import-dialog')).toBeVisible();
}

function csvFile(name: string, content: string): string {
  const f = path.join(tmpDir(), name);
  fs.writeFileSync(f, content);
  return f;
}

async function seedSome(page: Page) {
  await selectText(page, Q1);
  await addFeedbackViaDialog(page, { reviewer: 'Bob', status: 'Reject', comment: '=SUM(A1), "needs"\nevidence' });
  await selectText(page, Q2);
  await addFeedbackViaDialog(page, { reviewer: 'Cy', status: 'Accept with conditions', comment: 'ok if fixed \u2014 caf\u00e9' });
  await addDocFeedback(page, { reviewer: 'Ada', status: 'Accept' });
}

test.describe('whole-document feedback', () => {
  test('add feedback for each status, see it listed, in the summary and after reload', async ({ page }) => {
    await loadCopy(page, 'arc42-long.md');
    await seedParticipants(page, PEOPLE);
    await page.click('#btn-doc-feedback');
    await expect(page.locator('#side-panel')).toContainText('No whole-document feedback yet');

    // comment rules apply: required for Reject and Accept with conditions, optional for Accept
    await page.click('#add-doc-feedback');
    await expect(page.locator('#fb-quote')).toBeHidden(); // no quoted text for whole-document feedback
    await expect(page.locator('#fb-title')).toHaveText('Add document feedback');
    await page.locator('#fb-dialog').getByLabel('Reject', { exact: true }).check();
    await page.click('#fb-save');
    await expect(page.locator('#fb-error')).toContainText('comment is required');
    await page.click('#fb-cancel');

    await addDocFeedback(page, { reviewer: 'Bob', status: 'Reject', comment: 'Not ready' });
    await addDocFeedback(page, { reviewer: 'Cy', status: 'Accept with conditions', comment: 'Fix the diagrams' });
    await addDocFeedback(page, { reviewer: 'Ada', status: 'Accept' });

    const cards = page.locator('#side-panel .fb-card');
    await expect(cards).toHaveCount(3);
    await expect(cards.first()).toContainText('Accept'); // newest first
    await expect(page.locator('#side-panel')).toContainText('Whole document');
    await expect(page.locator('#side-panel')).toContainText('Not ready');
    await expect(page.locator('#side-panel')).toContainText('Fix the diagrams');
    await expect(cards.filter({ hasText: 'Ada' })).toContainText('(author)');

    const chip = page.locator('#fb-summary');
    await expect(chip).toHaveAttribute('data-reject', '1');
    await expect(chip).toHaveAttribute('data-cond', '1');
    await expect(chip).toHaveAttribute('data-accept', '1');
    await expect(page.locator('#all-count')).toHaveText('3');
    expect(Object.keys(await highlightInfo(page))).toEqual([]); // not text: no highlights or markers
    await expect(page.locator('.marker')).toHaveCount(0);

    await reload(page);
    await page.click('#btn-doc-feedback');
    await expect(page.locator('#side-panel .fb-card')).toHaveCount(3);
    await expect(page.locator('#fb-summary')).toHaveAttribute('data-reject', '1');
  });

  test('filter by status and reviewer, sort by date, edit and delete', async ({ page }) => {
    await loadCopy(page, 'arc42-long.md');
    await seedParticipants(page, PEOPLE);
    await addDocFeedback(page, { reviewer: 'Bob', status: 'Reject', comment: 'first' });
    await addDocFeedback(page, { reviewer: 'Cy', status: 'Accept', comment: 'second' });
    await addDocFeedback(page, { reviewer: 'Bob', status: 'Accept', comment: 'third' });
    const cards = page.locator('#side-panel .fb-card');
    await expect(cards).toHaveCount(3);
    await expect(cards.first()).toContainText('third');
    await page.selectOption('#flt-sort', 'oldest');
    await expect(cards.first()).toContainText('first');
    await page.selectOption('#flt-status', 'Accept');
    await expect(cards).toHaveCount(2);
    await page.selectOption('#flt-reviewer', { label: 'Bob' });
    await expect(cards).toHaveCount(1);
    await expect(cards).toContainText('third');
    await page.selectOption('#flt-status', '');
    await page.selectOption('#flt-reviewer', '');

    await cards.filter({ hasText: 'second' }).getByRole('button', { name: 'Edit' }).click();
    await page.locator('#fb-dialog').getByLabel('Reject', { exact: true }).check();
    await page.fill('#fb-comment', 'changed');
    await page.click('#fb-save');
    await expect(page.locator('#fb-summary')).toHaveAttribute('data-reject', '2');
    await cards.filter({ hasText: 'changed' }).getByRole('button', { name: 'Delete' }).click();
    await page.click('#confirm-yes');
    await expect(cards).toHaveCount(2);
    await expect(page.locator('#fb-summary')).toHaveAttribute('data-reject', '1');
  });
});

test.describe('participants: roles and author warning', () => {
  test('a role can be changed in place; the author warning is friendly and clears', async ({ page }) => {
    await loadCopy(page, 'arc42-long.md');
    await seedParticipants(page, [{ name: 'me' }]);
    await page.click('#btn-participants');
    const warn = page.locator('#ppl-warning');
    await expect(warn).toHaveText('No author is set. Mark one participant as the author so exports show who wrote the document.');
    await expect(warn).not.toContainText('found 0');

    await page.getByLabel('Role of me').selectOption('author');
    await expect(warn).toBeHidden();
    await expect(page.getByLabel('Role of me')).toHaveValue('author');

    await page.fill('#ppl-name', 'Bob');
    await page.click('#ppl-form button[type=submit]');
    await page.getByLabel('Role of Bob').selectOption('author');
    await expect(warn).toContainText('Several authors are set (2)');
    await page.getByLabel('Role of Bob').selectOption('reviewer');
    await expect(warn).toBeHidden();

    await reload(page); // persisted
    await page.click('#btn-participants');
    await expect(page.getByLabel('Role of me')).toHaveValue('author');
  });
});

test.describe('CSV export', () => {
  test('downloads one UTF-8 CSV with BOM, the required columns, guarded cells and exact text', async ({ page }) => {
    await loadCopy(page, 'arc42-long.md');
    await seedParticipants(page, PEOPLE);
    await seedSome(page);
    const { name, bytes } = await exportCsv(page);
    expect(name).toMatch(/^arc42-long-feedback-\d{8}-\d{4}\.csv$/);
    expect(Array.from(bytes.subarray(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    const text = bytes.toString('utf8').replace(/^\uFEFF/, '');
    expect(text.split('\r\n')[0]).toBe(HEADER);
    const rows = parse(text, { columns: true }) as Record<string, string>[];
    expect(rows).toHaveLength(3);
    const range = rows.find((r) => r.scope === 'range' && r.status === 'Reject')!;
    expect(range).toMatchObject({ document_name: 'arc42-long', reviewer: 'Bob', reviewer_role: 'reviewer', quote_exact: Q1, section_heading: '1. Introduction and Goals' });
    expect(range.document_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(range.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(range.created_at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}[+-]\d\d:\d\d$/);
    expect(Number(range.end_offset) - Number(range.start_offset)).toBe(Q1.length);
    expect(range.quote_suffix!.length).toBeGreaterThan(0);
    // the formula-looking comment is neutralised for Excel, with commas, quotes and the newline intact
    expect(range.comment).toBe('\'=SUM(A1), "needs"\nevidence');
    expect(rows.find((r) => r.status === 'Accept with conditions')!.comment).toBe('ok if fixed \u2014 caf\u00e9');
    const doc = rows.find((r) => r.scope === 'document')!;
    expect([doc.start_offset, doc.end_offset, doc.quote_exact, doc.quote_prefix, doc.quote_suffix, doc.section_heading]).toEqual(['', '', '', '', '', '']);
    expect(doc.reviewer_role).toBe('author');
  });
});

test.describe('CSV import', () => {
  test('export then Replace: counts, automatic backup, and everything comes back with highlights', async ({ page }) => {
    await loadCopy(page, 'arc42-long.md');
    await seedParticipants(page, PEOPLE);
    await seedSome(page);
    const { file } = await exportCsv(page);

    // delete the document feedback so Replace has something different to bring back
    await page.click('#btn-doc-feedback');
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.click('#confirm-yes');
    await expect(page.locator('#all-count')).toHaveText('2');

    await openImport(page, file);
    const sum = page.locator('#imp-summary');
    await expect(sum).toContainText('3 rows in the file: 3 valid, 0 will be skipped');
    await expect(sum).toContainText('By scope: 1 document, 2 range');
    await expect(sum).toContainText('By status: 1 Reject, 1 Accept with conditions, 1 Accept');
    await expect(page.locator('#imp-hash-warning')).toHaveCount(0); // same document
    await expect(page.getByLabel(/Merge/)).toBeChecked(); // the safe option is the default
    await page.getByLabel(/Replace/).check();
    await page.click('#imp-go');

    const rep = page.locator('#imp-report');
    await expect(rep).toContainText('Imported 3 items (replace)');
    await expect(rep).toContainText('Backup of the previous feedback saved to:');
    const backups = fs.readdirSync(path.join(dataDir(), 'backups')).filter((f) => f.startsWith('arc42-long-backup-'));
    expect(backups.length).toBeGreaterThan(0);
    const latest = backups.map((b) => path.join(dataDir(), 'backups', b)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0]!;
    expect(fs.readFileSync(latest, 'utf8')).toContain(Q1); // the backup holds what was replaced
    await page.click('#imp-cancel');

    await expect(page.locator('#all-count')).toHaveText('3');
    await expect(page.locator('#fb-summary')).toHaveAttribute('data-accept', '1');
    const hl = await highlightInfo(page);
    expect(hl['rt-reject']!.text).toEqual([Q1]);
    expect(hl['rt-cond']!.text).toEqual([Q2]);
    await page.click('#btn-all-feedback');
    await expect(page.locator('#side-panel .fb-card').filter({ hasText: '=SUM(A1), "needs"' })).toHaveCount(1);
    await expect(page.locator('#side-panel .fb-card').filter({ hasText: 'caf\u00e9' })).toHaveCount(1);
    await reload(page); // persisted
    await expect(page.locator('#all-count')).toHaveText('3');
  });

  test('Merge skips ids that already exist and reports them as duplicates', async ({ page }) => {
    await loadCopy(page, 'arc42-long.md');
    await seedParticipants(page, PEOPLE);
    await seedSome(page);
    const { bytes } = await exportCsv(page);
    const text = bytes.toString('utf8').replace(/^\uFEFF/, '');
    const extra = `99999999-9999-4999-8999-999999999999,arc42-long,,document,Reject,Zed,reviewer,2026-11-18T10:00:00.000+10:00,2026-11-18T10:00:00.000+10:00,from the file,,,,,,\r\n`;
    const file = csvFile('merge.csv', text + extra);
    await openImport(page, file);
    await expect(page.locator('#imp-summary')).toContainText('4 rows in the file: 4 valid');
    await expect(page.locator('#import-dialog')).toContainText('New participants will be added: Zed');
    await expect(page.locator('#import-dialog')).toContainText('3 items already here will be skipped');
    await page.click('#imp-go');
    const rep = page.locator('#imp-report');
    await expect(rep).toContainText('Imported 1 item (merge)');
    await expect(rep).toContainText('3 duplicates skipped');
    await expect(rep).toContainText('Participants added: Zed');
    await expect(rep).not.toContainText('Backup'); // merge is not destructive
    await page.click('#imp-cancel');
    await expect(page.locator('#all-count')).toHaveText('4');
    await page.click('#btn-participants');
    await expect(page.locator('#ppl-list')).toContainText('Zed');

    // merging the same file again adds nothing
    await page.click('#btn-all-feedback');
    await openImport(page, file);
    await page.click('#imp-go');
    await expect(page.locator('#imp-report')).toContainText('Imported 0 items (merge)');
    await expect(page.locator('#imp-report')).toContainText('4 duplicates skipped');
    await page.click('#imp-cancel');
    await expect(page.locator('#all-count')).toHaveText('4');
  });

  test('a file with some bad rows imports the valid ones and lists the skipped rows with reasons', async ({ page }) => {
    await loadCopy(page, 'arc42-long.md');
    await seedParticipants(page, PEOPLE);
    const ok = (n: number, extra = '') => `0000000${n}-0000-4000-8000-000000000000,arc42-long,,document,Accept,Ada,author,2026-11-18T10:00:00+10:00,,${extra},,,,,\r\n`;
    const rows =
      ok(1) +
      `bad-id,arc42-long,,document,Accept,Ada,author,2026-11-18T10:00:00+10:00,,,,,,,\r\n` +
      `00000002-0000-4000-8000-000000000000,arc42-long,,document,Maybe,Ada,author,2026-11-18T10:00:00+10:00,,,,,,,\r\n` +
      `00000003-0000-4000-8000-000000000000,arc42-long,,document,Accept,Ada,author,yesterday,,,,,,,\r\n` +
      `00000004-0000-4000-8000-000000000000,arc42-long,,document,Reject,Ada,author,2026-11-18T10:00:00+10:00,,,,,,,\r\n` +
      `00000005-0000-4000-8000-000000000000,arc42-long,,range,Accept,Ada,author,2026-11-18T10:00:00+10:00,,,,9,3,quote,,\r\n`;
    await openImport(page, csvFile('partial.csv', `${HEADER}\r\n${rows}`));
    await expect(page.locator('#imp-summary')).toContainText('6 rows in the file: 1 valid, 5 will be skipped');
    const errs = page.locator('.imp-errors');
    await expect(errs).toContainText('Row 3: id "bad-id" is not a UUID');
    await expect(errs).toContainText('Row 4: status "Maybe"');
    await expect(errs).toContainText('Row 5: created_at "yesterday"');
    await expect(errs).toContainText('Row 6: comment is required for "Reject"');
    await expect(errs).toContainText('Row 7: end_offset must be greater than start_offset');
    await page.click('#imp-go');
    await expect(page.locator('#imp-report')).toContainText('Imported 1 item');
    await expect(page.locator('#imp-report')).toContainText('5 invalid rows skipped');
    await expect(page.locator('#imp-report')).toContainText('Row 6');
    await page.click('#imp-cancel');
    await expect(page.locator('#all-count')).toHaveText('1');
  });

  test('files that cannot be imported are rejected with a clear message and nothing changes', async ({ page }) => {
    await loadCopy(page, 'arc42-long.md');
    await seedParticipants(page, PEOPLE);
    await seedSome(page);
    const cases: [string, string, string][] = [
      ['missing.csv', 'id,scope,status\r\n1,document,Accept\r\n', 'Missing required columns: reviewer, created_at, comment, start_offset, end_offset, quote_exact'],
      ['empty.csv', '', 'The file is empty'],
      ['header-only.csv', `${HEADER}\r\n`, 'no feedback rows'],
      ['broken.csv', `${HEADER}\r\n"unterminated`, 'Could not read the CSV'],
    ];
    for (const [name, content, msg] of cases) {
      await openImport(page, csvFile(name, content));
      await expect(page.locator('#import-dialog')).toContainText(`Could not import ${name}`);
      await expect(page.locator('#import-dialog')).toContainText(msg);
      await expect(page.locator('#imp-go')).toBeHidden();
      await page.click('#imp-cancel');
      await expect(page.locator('#import-dialog')).toBeHidden();
    }
    await expect(page.locator('#all-count')).toHaveText('3');
  });

  test('if every row is invalid nothing can be imported, no backup is made and nothing is deleted', async ({ page }) => {
    const file = await loadCopy(page, 'arc42-long.md');
    await seedParticipants(page, PEOPLE);
    await seedSome(page);
    const before = fs.existsSync(path.join(dataDir(), 'backups')) ? fs.readdirSync(path.join(dataDir(), 'backups')).length : 0;
    await openImport(page, csvFile('allbad.csv', `${HEADER}\r\nx,${path.basename(file)},,page,Maybe,,nope,,,,,,,,\r\ny,d,,range,Accept,Ada,author,2026-11-18,,,1,1,q,,\r\n`));
    await expect(page.locator('#imp-summary')).toContainText('0 valid, 2 will be skipped');
    await expect(page.locator('#import-dialog')).toContainText('nothing can be imported');
    await expect(page.locator('#imp-go')).toBeHidden();
    await page.click('#imp-cancel');
    await expect(page.locator('#all-count')).toHaveText('3');
    const after = fs.existsSync(path.join(dataDir(), 'backups')) ? fs.readdirSync(path.join(dataDir(), 'backups')).length : 0;
    expect(after).toBe(before);
  });

  test('a document hash mismatch warns, and moved text is re-anchored while missing text is reported', async ({ page }) => {
    const doc = copyDoc('anchor.md', '# D\n\n## 1. One\n\nFirst sentence here.\n\nSecond sentence there.\n\n## 2. Two\n\nThird one.\n');
    await loadPath(page, doc);
    await seedParticipants(page, PEOPLE);
    await selectText(page, 'Second sentence there.');
    await addFeedbackViaDialog(page, { reviewer: 'Bob', status: 'Accept with conditions', comment: 'keep this' });
    await selectText(page, 'Third one.');
    await addFeedbackViaDialog(page, { reviewer: 'Cy', status: 'Reject', comment: 'will vanish' });
    const { bytes } = await exportCsv(page);

    // the document changes: text moves down and one quoted sentence disappears
    fs.writeFileSync(doc, '# D\n\nNew intro paragraph that pushes things down.\n\n## 1. One\n\nFirst sentence here.\n\nSecond sentence there.\n\n## 2. Two\n\nSomething else.\n');
    await loadPath(page, doc);
    await page.click('#btn-all-feedback');
    // start clean, then import the old export with Replace
    await openImport(page, csvFile('old.csv', bytes.toString('utf8')));
    await expect(page.locator('#imp-hash-warning')).toContainText('different version of the document');
    await page.getByLabel(/Replace/).check();
    await page.click('#imp-go');
    const rep = page.locator('#imp-report');
    await expect(rep).toContainText('1 imported item could not be located in the document');
    await page.click('#imp-cancel');

    const hl = await highlightInfo(page);
    expect(hl['rt-cond']!.text).toEqual(['Second sentence there.']); // re-anchored despite stale offsets
    expect('rt-reject' in hl).toBe(false);
    await page.click('#btn-all-feedback');
    await expect(page.locator('#side-panel .fb-group').filter({ hasText: 'Could not locate' })).toContainText('will vanish');
    await page.click('#diag-indicator');
    await expect(page.locator('#diag-panel')).toContainText('could not be located');
  });

  test('imported anchors that now span two sections are kept but flagged', async ({ page }) => {
    const doc = copyDoc('span.md', '# D\n\n## 1. One\n\nAlpha beta.\n\n## 2. Two\n\nGamma delta.\n');
    await loadPath(page, doc);
    await seedParticipants(page, PEOPLE);
    // the quote is "Alpha beta." + heading "2. Two" + "Gamma" as the text model renders them (one \n per block)
    const row = `10000000-0000-4000-8000-000000000000,span,,range,Accept,Bob,reviewer,2026-11-18T10:00:00+10:00,,fine,1. One,0,40,"Alpha beta.\n2. Two\nGamma",,\r\n`;
    await openImport(page, csvFile('span.csv', `${HEADER}\r\n${row}`));
    await page.click('#imp-go');
    await expect(page.locator('#imp-report')).toContainText('Imported 1 item');
    await expect(page.locator('#imp-report')).not.toContainText('could not be located');
    await page.click('#imp-cancel');
    // kept and highlighted, but flagged in diagnostics (import is not blocked by the one-section rule)
    expect((await highlightInfo(page))['rt-accept']!.text[0]).toContain('Alpha beta.');
    await page.click('#diag-indicator');
    await expect(page.locator('#diag-panel')).toContainText('now spans more than one section');
    await expect(page.locator('#diag-indicator')).toHaveAttribute('data-state', 'orange');
    await expect(page.locator('#all-count')).toHaveText('1');
  });
});
