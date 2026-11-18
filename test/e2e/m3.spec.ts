import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from './fixtures.js';
import { addFeedbackViaDialog, settle, copyDoc, highlightInfo, loadCopy, loadPath, pointOf, reload, seedParticipants, selectText } from './helpers.js';

const PEOPLE = [{ name: 'Ada', role: 'author' as const }, { name: 'Bob' }, { name: 'Cy' }];
const Q1 = 'Paragraph 2 of section 1.1.';
const Q2 = 'Paragraph 3 of section 3.2.';

test.describe('range feedback', () => {
  test('select text in a section, add feedback, see highlight, marker and panel entry; persists on reload', async ({ page }) => {
    await loadCopy(page, 'arc42-long.md');
    await seedParticipants(page, PEOPLE);
    await selectText(page, Q1);
    await expect(page.locator('#sel-add')).toBeVisible();
    await page.click('#sel-add');
    await expect(page.locator('#fb-quote')).toHaveText(Q1); // quoted text at the top of the form
    await page.click('#fb-cancel');

    await selectText(page, Q1);
    await addFeedbackViaDialog(page, { reviewer: 'Bob', status: 'Reject', comment: 'Needs evidence' });

    const hl = await highlightInfo(page);
    expect(hl['rt-reject']!.text).toEqual([Q1]);
    await expect(page.locator('.fb-marker')).toHaveCount(1);
    await expect(page.locator('.fb-marker .mk-count')).toHaveText('1');
    await expect(page.locator('#all-count')).toHaveText('1');

    await reload(page);
    expect((await highlightInfo(page))['rt-reject']!.text).toEqual([Q1]);
    await page.click('#btn-all-feedback');
    await expect(page.locator('#side-panel .fb-card')).toHaveCount(1);
    await expect(page.locator('#side-panel .fb-card')).toContainText('Needs evidence');
    await expect(page.locator('#side-panel .fb-card')).toContainText('Bob');
  });

  test('reviewer defaults to the last reviewer used', async ({ page }) => {
    await loadCopy(page, 'arc42-long.md');
    await seedParticipants(page, PEOPLE);
    await selectText(page, Q1);
    await addFeedbackViaDialog(page, { reviewer: 'Cy', status: 'Accept' });
    await selectText(page, Q2);
    await page.click('#sel-add');
    await expect(page.locator('#fb-reviewer')).toHaveValue(
      await page.locator('#fb-reviewer option', { hasText: /^Cy \(/ }).getAttribute('value') as string,
    );
  });

  test('a selection across two sections shows a message naming both and no button', async ({ page }) => {
    await loadCopy(page, 'arc42-long.md');
    await seedParticipants(page, PEOPLE);
    await selectText(page, 'Paragraph 6 of section 1.2.', { endText: '2. Constraints' });
    await expect(page.locator('#sel-add')).toBeHidden();
    const msg = page.locator('#sel-msg');
    await expect(msg).toBeVisible();
    await expect(msg).toContainText('Feedback can cover at most one section');
    await expect(msg).toContainText("'1. Introduction and Goals'");
    await expect(msg).toContainText("'2. Constraints'");
    // dismissed on the next click
    await page.mouse.click(5, 300);
    await expect(msg).toBeHidden();
  });

  test('a selection across H3 subsections of one section, including its heading, is allowed', async ({ page }) => {
    await loadCopy(page, 'arc42-long.md');
    await seedParticipants(page, PEOPLE);
    await selectText(page, '2. Constraints', { endText: 'Paragraph 2 of section 2.2.' });
    await expect(page.locator('#sel-add')).toBeVisible();
  });

  test('collapsed, whitespace-only and chrome selections are ignored', async ({ page }) => {
    await loadCopy(page, 'arc42-long.md');
    await seedParticipants(page, PEOPLE);
    await page.evaluate(() => {
      const p = document.querySelector('#doc p')!;
      const r = new Range();
      r.setStart(p.firstChild!, 3);
      r.collapse(true);
      const s = getSelection()!;
      s.removeAllRanges();
      s.addRange(r);
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
    await settle(page);
    await expect(page.locator('#sel-ui')).toBeHidden();
    // from the header (app chrome) into the document
    await page.evaluate(() => {
      const title = document.querySelector('.doc-title')!.firstChild!;
      const p = document.querySelector('#doc p')!.firstChild!;
      const s = getSelection()!;
      s.setBaseAndExtent(title, 0, p, 5);
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
    await settle(page);
    await expect(page.locator('#sel-ui')).toBeHidden();
    // whitespace between two blocks
    await page.evaluate(() => {
      // two ADJACENT paragraphs: from the end of one to the very start of the next (only the break between them)
      const first = document.querySelectorAll('#doc p')[2]!;
      const second = first.nextElementSibling!;
      if (second.tagName !== 'P') throw new Error('expected adjacent paragraphs');
      const s = getSelection()!;
      s.setBaseAndExtent(first, first.childNodes.length, second, 0);
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
    await settle(page);
    await expect(page.locator('#sel-ui')).toBeHidden();
  });

  test('a real mouse drag over text offers the button', async ({ page }) => {
    await loadCopy(page, 'arc42-long.md');
    await seedParticipants(page, PEOPLE);
    const a = await pointOf(page, 'Paragraph 1 of section 1.1.');
    await page.mouse.move(a.x - 60, a.y);
    await page.mouse.down();
    await page.mouse.move(a.x + 60, a.y, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator('#sel-add')).toBeVisible();
  });

  test('empty comment on Reject is a validation error; Accept needs no comment', async ({ page }) => {
    await loadCopy(page, 'arc42-long.md');
    await seedParticipants(page, PEOPLE);
    await selectText(page, Q1);
    await page.click('#sel-add');
    await page.locator('#fb-dialog').getByLabel('Reject', { exact: true }).check();
    await page.click('#fb-save');
    await expect(page.locator('#fb-error')).toContainText('comment is required');
    await expect(page.locator('#fb-dialog')).toBeVisible();
    await page.locator('#fb-dialog').getByLabel('Accept with conditions').check();
    await page.click('#fb-save');
    await expect(page.locator('#fb-error')).toContainText('comment is required');
    await page.locator('#fb-dialog').getByLabel('Accept', { exact: true }).check();
    await page.click('#fb-save');
    await expect(page.locator('#fb-dialog')).toBeHidden();
    expect((await highlightInfo(page))['rt-accept']!.size).toBe(1);
  });

  test('shortcuts do not fire while typing a comment', async ({ page }) => {
    await loadCopy(page, 'arc42-long.md');
    await seedParticipants(page, PEOPLE);
    await selectText(page, Q1);
    await page.click('#sel-add');
    const y0 = await page.evaluate(() => scrollY);
    await page.focus('#fb-comment');
    for (const k of ['PageDown', 'End', 'Control+ArrowDown', 'Alt+ArrowDown']) await page.keyboard.press(k);
    expect(await page.evaluate(() => scrollY)).toBe(y0);
  });

  test('overlapping ranges deepen the tint, the most severe status wins, and clicking the overlap lists both', async ({ page }) => {
    await loadCopy(page, 'arc42-long.md');
    await seedParticipants(page, PEOPLE);
    await selectText(page, 'Paragraph 4 of section 2.1. Lorem ipsum');
    await addFeedbackViaDialog(page, { reviewer: 'Bob', status: 'Accept' });
    await selectText(page, '2.1. Lorem ipsum dolor sit amet', { occurrence: 3 });
    await addFeedbackViaDialog(page, { reviewer: 'Cy', status: 'Reject', comment: 'Disagree' });

    const hl = await highlightInfo(page);
    expect(hl['rt-accept']!.priority).toBeLessThan(hl['rt-reject']!.priority);

    // the overlap is "2.1. Lorem ipsum" in the 4th paragraph of section 2.1 (the 4th such fragment in the document)
    const p = await pointOf(page, '2.1. Lorem ipsum', 3);
    await page.mouse.click(p.x, p.y);
    const cards = page.locator('#side-panel .fb-card');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText('Reject');
    await expect(cards.nth(1)).toContainText('Accept');

    // outside the overlap only one item
    await page.keyboard.press('Escape');
    const only = await pointOf(page, 'Paragraph 4 of section 2.1');
    await page.mouse.click(only.x - 20, only.y);
    await expect(page.locator('#side-panel .fb-card')).toHaveCount(1);

    // margin marker shows the count of items in the block and opens the panel
    await expect(page.locator('.fb-marker .mk-count')).toHaveText('2');
    await page.locator('.fb-marker').click();
    await expect(page.locator('#side-panel .fb-card')).toHaveCount(2);
  });

  test('hovering highlighted text shows a tooltip summary', async ({ page }) => {
    await loadCopy(page, 'arc42-long.md');
    await seedParticipants(page, PEOPLE);
    await selectText(page, Q1);
    await addFeedbackViaDialog(page, { reviewer: 'Bob', status: 'Reject', comment: 'Hover me' });
    const p = await pointOf(page, Q1);
    await page.mouse.move(p.x, p.y);
    await expect(page.locator('#hl-tooltip')).toBeVisible();
    await expect(page.locator('#hl-tooltip')).toContainText('Reject');
    await expect(page.locator('#hl-tooltip')).toContainText('Hover me');
    await page.mouse.move(5, 400);
    await expect(page.locator('#hl-tooltip')).toBeHidden();
  });

  test('clicking a panel item emphasises its exact range briefly', async ({ page }) => {
    await loadCopy(page, 'arc42-long.md');
    await seedParticipants(page, PEOPLE);
    await selectText(page, Q2);
    await addFeedbackViaDialog(page, { reviewer: 'Ada', status: 'Accept with conditions', comment: 'ok if fixed' });
    await page.keyboard.press('Home');
    await page.click('#btn-all-feedback');
    await page.locator('#side-panel .fb-card').click();
    expect((await highlightInfo(page))['rt-flash']!.text).toEqual([Q2]);
    await expect.poll(async () => 'rt-flash' in (await highlightInfo(page)), { timeout: 5000 }).toBe(false);
  });

  test('edit and delete feedback (delete asks for confirmation)', async ({ page }) => {
    await loadCopy(page, 'arc42-long.md');
    await seedParticipants(page, PEOPLE);
    await selectText(page, Q1);
    await addFeedbackViaDialog(page, { reviewer: 'Bob', status: 'Reject', comment: 'first' });
    await page.click('#btn-all-feedback');
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.locator('#fb-dialog').getByLabel('Accept', { exact: true }).check();
    await page.fill('#fb-comment', 'changed my mind');
    await page.click('#fb-save');
    await expect(page.locator('#side-panel .fb-card')).toContainText('changed my mind');
    expect((await highlightInfo(page))['rt-accept']!.size).toBe(1);
    expect('rt-reject' in (await highlightInfo(page))).toBe(false);

    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.locator('#confirm-dialog')).toBeVisible();
    await page.click('#confirm-no');
    await expect(page.locator('#side-panel .fb-card')).toHaveCount(1);
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.click('#confirm-yes');
    await expect(page.locator('#side-panel .fb-card')).toHaveCount(0);
    expect(Object.keys(await highlightInfo(page))).toEqual([]);
    await expect(page.locator('.fb-marker')).toHaveCount(0);
    await reload(page);
    await expect(page.locator('#all-count')).toHaveText('0');
  });

  test('the highlights toggle hides tints and markers without losing feedback', async ({ page }) => {
    await loadCopy(page, 'arc42-long.md');
    await seedParticipants(page, PEOPLE);
    await selectText(page, Q1);
    await addFeedbackViaDialog(page, { reviewer: 'Bob', status: 'Reject', comment: 'x' });
    await page.click('#btn-hl');
    expect(Object.keys(await highlightInfo(page))).toEqual([]);
    await expect(page.locator('.fb-marker')).toHaveCount(0);
    await expect(page.locator('#all-count')).toHaveText('1');
    await page.click('#btn-hl');
    expect((await highlightInfo(page))['rt-reject']!.size).toBe(1);
    await expect(page.locator('.fb-marker')).toHaveCount(1);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`highlight tint is drawn and deepens on overlap in the ${scheme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await loadCopy(page, 'arc42-long.md');
      await seedParticipants(page, PEOPLE);
      await selectText(page, 'Paragraph 5 of section 3.1. Lorem ipsum');
      await addFeedbackViaDialog(page, { reviewer: 'Bob', status: 'Accept with conditions', comment: 'a' });
      await selectText(page, '3.1. Lorem ipsum dolor', { occurrence: 4 });
      await addFeedbackViaDialog(page, { reviewer: 'Cy', status: 'Accept with conditions', comment: 'b' });
      await page.mouse.move(2, 2);

      // sample pixels at the middle of the first space inside a fragment (a space has no glyph ink)
      const target = async (frag: string, occ = 0) => {
        await pointOf(page, frag, occ); // scrolls into view
        return page.evaluate(({ frag, occ }) => {
          const walker = document.createTreeWalker(document.getElementById('doc')!, NodeFilter.SHOW_TEXT);
          let seen = 0;
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            const i = (n as Text).data.indexOf(frag);
            if (i >= 0 && seen++ === occ) {
              const at = i + frag.indexOf(' ');
              const r = new Range();
              r.setStart(n, at);
              r.setEnd(n, at + 1);
              const b = r.getBoundingClientRect();
              return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
            }
          }
          throw new Error('nf');
        }, { frag, occ });
      };
      const pixel = async (pt: { x: number; y: number }) => {
        const png = await page.screenshot({ clip: { x: Math.floor(pt.x), y: Math.floor(pt.y), width: 1, height: 1 } });
        return page.evaluate(async (b64) => {
          // (the page CSP forbids fetch('data:...'), so decode by hand)
          const bin = atob(b64);
          const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
          const img = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
          const c = document.createElement('canvas');
          c.width = 1;
          c.height = 1;
          const g = c.getContext('2d')!;
          g.drawImage(img, 0, 0);
          return Array.from(g.getImageData(0, 0, 1, 1).data).slice(0, 3);
        }, png.toString('base64'));
      };
      const plain = await pixel(await target('Lorem ipsum'));
      const single = await pixel(await target('Paragraph 5 of section 3.1.'));
      const double = await pixel(await target('3.1. Lorem ipsum', 4));
      const sum = (c: number[]) => c[0]! + c[1]! + c[2]!;
      const bg = scheme === 'dark' ? [15, 27, 38] : [241, 244, 242];
      expect(plain).toEqual(bg);
      // tint is applied...
      expect(single).not.toEqual(plain);
      // ...and a second overlapping layer shifts the colour further from the background
      const dist = (c: number[]) => Math.abs(c[0]! - bg[0]!) + Math.abs(c[1]! - bg[1]!) + Math.abs(c[2]! - bg[2]!);
      expect(dist(double)).toBeGreaterThan(dist(single));
      expect(sum(single)).toBeGreaterThan(0);
    });
  }
});

test.describe('re-anchoring after the document changes', () => {
  const base = (extra = '') => `# Doc\n\n## 1. One\n\n${extra}The first paragraph says alpha beta gamma.\n\nThe second paragraph repeats alpha beta gamma here.\n\n## 2. Two\n\nSomething else entirely.\n`;

  test('moved text is re-attached, edited-away text is listed as could-not-locate with a warning', async ({ page }) => {
    const file = copyDoc('re.md', base());
    await loadPath(page, file);
    await seedParticipants(page, PEOPLE);
    await selectText(page, 'The second paragraph repeats alpha beta gamma here.');
    await addFeedbackViaDialog(page, { reviewer: 'Bob', status: 'Accept with conditions', comment: 'keep' });
    await selectText(page, 'Something else entirely.');
    await addFeedbackViaDialog(page, { reviewer: 'Bob', status: 'Reject', comment: 'will vanish' });
    await expect(page.locator('#diag-indicator')).toHaveAttribute('data-state', 'green');

    // edit the file: insert text before (offsets go stale) and remove one quoted sentence
    fs.writeFileSync(file, base('A brand new paragraph that shifts everything.\n\n').replace('Something else entirely.', 'Totally different words.'));
    await loadPath(page, file);

    const hl = await highlightInfo(page);
    expect(hl['rt-cond']!.text).toEqual(['The second paragraph repeats alpha beta gamma here.']);
    expect('rt-reject' in hl).toBe(false);
    const ind = page.locator('#diag-indicator');
    await expect(ind).toHaveAttribute('data-state', 'orange');
    await ind.click();
    await expect(page.locator('#diag-panel')).toContainText('changed since it was last reviewed');
    await expect(page.locator('#diag-panel')).toContainText('could not be located');

    await page.click('#btn-all-feedback');
    await expect(page.getByRole('heading', { name: /Could not locate in document/ })).toBeVisible();
    await expect(page.locator('#side-panel .fb-group').filter({ hasText: 'Could not locate' })).toContainText('will vanish');

    // re-anchored offsets were saved: the warning is gone after the next reload of the same text
    await loadPath(page, file);
    await page.click('#diag-indicator');
    await expect(page.locator('#diag-panel')).not.toContainText('changed since it was last reviewed');
  });

  test('an ambiguous quote is disambiguated by surrounding context', async ({ page }) => {
    const file = copyDoc('amb.md', base());
    await loadPath(page, file);
    await seedParticipants(page, PEOPLE);
    await selectText(page, 'alpha beta gamma', { occurrence: 1 }); // the one in the second paragraph
    await addFeedbackViaDialog(page, { reviewer: 'Ada', status: 'Accept', comment: 'second one' });
    fs.writeFileSync(file, base('Inserted paragraph one.\n\nInserted paragraph two with alpha beta gamma too.\n\n'));
    await loadPath(page, file);
    const text = (await highlightInfo(page))['rt-accept']!.text;
    expect(text).toEqual(['alpha beta gamma']);
    const inSecond = await page.evaluate(() => {
      const r = (CSS as any).highlights.get('rt-accept-0').values().next().value as Range;
      return r.startContainer.parentElement!.textContent!.startsWith('The second paragraph');
    });
    expect(inSecond).toBe(true);
  });
});

test.describe('participants', () => {
  test('add manually, import a CSV, and see the author warning', async ({ page }) => {
    await loadCopy(page, 'arc42-long.md');
    await page.click('#btn-participants');
    await page.fill('#ppl-name', 'Ada Lovelace');
    await page.selectOption('#ppl-role', 'author');
    await page.click('#ppl-form button[type=submit]');
    await expect(page.locator('#ppl-list li')).toHaveCount(1);
    await page.fill('#ppl-name', 'ada lovelace');
    await page.click('#ppl-form button[type=submit]');
    await expect(page.locator('#ppl-error')).toContainText('already exists');

    const csv = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rt-csv-')), 'people.csv');
    fs.writeFileSync(csv, 'name,email,role\nBob,bob@example.com,reviewer\nCy,,author\n');
    await page.setInputFiles('#ppl-file', csv);
    await expect(page.locator('#ppl-report')).toContainText('Imported 2 participants');
    await expect(page.locator('#ppl-warning')).toContainText('Several authors are set (2)');
    await expect(page.locator('#ppl-list li')).toHaveCount(3);
  });

  test('a malformed participant file lists the offending rows and imports nothing', async ({ page }) => {
    await loadCopy(page, 'arc42-long.md');
    await page.click('#btn-participants');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rt-csv-'));
    const bad = path.join(dir, 'bad.csv');
    fs.writeFileSync(bad, 'name,role\nAda,author\n,reviewer\nBob,boss\nada,reviewer\n');
    await page.setInputFiles('#ppl-file', bad);
    const rep = page.locator('#ppl-report');
    await expect(rep).toContainText('Could not import bad.csv');
    await expect(rep).toContainText('Row 3');
    await expect(rep).toContainText('Row 4');
    await expect(rep).toContainText('Row 5: Duplicate name');
    await expect(page.locator('#ppl-list li')).toHaveCount(0);

    for (const [name, content, msg] of [
      ['empty.csv', '', 'The file is empty'],
      ['nocol.csv', 'email\na@b.c\n', 'Missing required column "name"'],
      ['bad.json', '[{"name":', 'Malformed JSON'],
    ] as const) {
      const f = path.join(dir, name);
      fs.writeFileSync(f, content);
      await page.setInputFiles('#ppl-file', f);
      await expect(rep).toContainText(msg);
    }
  });

  test('a new participant can be added from the feedback dialog', async ({ page }) => {
    await loadCopy(page, 'arc42-long.md');
    await selectText(page, Q1);
    await page.click('#sel-add');
    await expect(page.locator('#fb-newreviewer')).toBeVisible(); // no participants yet
    await page.fill('#fb-newname', 'Dana');
    await page.locator('#fb-dialog').getByLabel('Accept', { exact: true }).check();
    await page.click('#fb-save');
    await expect(page.locator('#fb-dialog')).toBeHidden();
    await page.click('#btn-participants');
    await expect(page.locator('#ppl-list')).toContainText('Dana');
  });
});

test.describe('filters in the All feedback panel', () => {
  test('filter by status and reviewer and sort by date', async ({ page }) => {
    await loadCopy(page, 'arc42-long.md');
    await seedParticipants(page, PEOPLE);
    const items: [string, string, 'Reject' | 'Accept', string][] = [
      [Q1, 'Bob', 'Reject', 'r1'],
      [Q2, 'Cy', 'Accept', 'a1'],
      ['Paragraph 1 of section 4.1.', 'Bob', 'Accept', 'a2'],
    ];
    for (const [q, who, status, c] of items) {
      await selectText(page, q);
      await addFeedbackViaDialog(page, { reviewer: who, status, comment: c });
    }
    await page.click('#btn-all-feedback');
    await expect(page.locator('#side-panel .fb-card')).toHaveCount(3);
    await page.selectOption('#flt-status', 'Accept');
    await expect(page.locator('#side-panel .fb-card')).toHaveCount(2);
    await page.selectOption('#flt-reviewer', { label: 'Bob' });
    await expect(page.locator('#side-panel .fb-card')).toHaveCount(1);
    await expect(page.locator('#side-panel .fb-card')).toContainText('a2');
    await page.selectOption('#flt-status', '');
    await page.selectOption('#flt-reviewer', '');
    await page.selectOption('#flt-sort', 'oldest');
    await expect(page.locator('#side-panel .fb-card').first()).toContainText('r1');
    await page.selectOption('#flt-sort', 'newest');
    await expect(page.locator('#side-panel .fb-card').first()).toContainText('a2');
  });
});
