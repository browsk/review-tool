import { api } from './api.js';
import { resolveAnchors } from './highlights.js';
import { store } from './store.js';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

interface Preview {
  token: string | null;
  totalRows: number;
  validRows: number;
  byScope: Record<string, number>;
  byStatus: Record<string, number>;
  errors: { row: number; message: string }[];
  hashMismatch: boolean;
  newReviewers: string[];
  duplicates: number;
  existingCount: number;
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

function list(items: string[], max = 50): HTMLElement {
  const ul = el('ul', 'imp-list');
  for (const i of items.slice(0, max)) ul.append(el('li', undefined, i));
  if (items.length > max) ul.append(el('li', 'hint', `…and ${items.length - max} more`));
  return ul;
}

function show(): { dlg: HTMLDialogElement; body: HTMLElement; go: HTMLButtonElement; cancel: HTMLButtonElement } {
  const dlg = $<HTMLDialogElement>('import-dialog');
  const go = $<HTMLButtonElement>('imp-go');
  const cancel = $<HTMLButtonElement>('imp-cancel');
  go.hidden = false;
  go.disabled = false;
  cancel.textContent = 'Cancel';
  cancel.onclick = () => dlg.close();
  if (!dlg.open) dlg.showModal();
  return { dlg, body: $('imp-body'), go, cancel };
}

function fail(message: string, detail?: string[]): void {
  const { body, go, cancel } = show();
  body.replaceChildren(el('p', 'error', message));
  if (detail?.length) body.append(list(detail));
  go.hidden = true;
  cancel.textContent = 'Close';
}

/** Step 1 (preview) then the confirmation dialog; step 2 commits Replace or Merge. */
export async function startImport(filename: string, content: string): Promise<void> {
  const r = await api<Preview & { fatal?: string; error?: string }>('POST', '/api/import/preview', { content });
  if (!r.ok) return fail(`Could not import ${filename}`, [r.data.fatal ?? r.data.error ?? 'The file could not be read.']);
  const p = r.data;
  const { dlg, body, go } = show();
  $('imp-title').textContent = `Import feedback from ${filename}`;
  body.replaceChildren();

  const summary = el('div', 'imp-summary');
  summary.id = 'imp-summary';
  summary.append(
    el('p', undefined, `${plural(p.totalRows, 'row')} in the file: ${p.validRows} valid, ${p.errors.length} will be skipped.`),
    el('p', undefined, `By scope: ${p.byScope.document ?? 0} document, ${p.byScope.range ?? 0} range.`),
    el(
      'p',
      undefined,
      `By status: ${p.byStatus.Reject ?? 0} Reject, ${p.byStatus['Accept with conditions'] ?? 0} Accept with conditions, ${p.byStatus.Accept ?? 0} Accept.`,
    ),
  );
  body.append(summary);

  if (p.hashMismatch) {
    const w = el('p', 'warn', 'This feedback was exported from a different version of the document (document_sha256 does not match). It will be re-anchored by its quoted text, and some items may not be found.');
    w.id = 'imp-hash-warning';
    body.append(w);
  }
  if (p.newReviewers.length) body.append(el('p', 'hint', `New participants will be added: ${p.newReviewers.join(', ')}.`));
  if (p.errors.length) {
    const d = el('details', 'imp-errors');
    d.open = true;
    d.append(el('summary', undefined, `Skipped rows (${p.errors.length})`), list(p.errors.map((e) => `Row ${e.row}: ${e.message}`)));
    body.append(d);
  }
  if (!p.validRows || !p.token) {
    body.append(el('p', 'error', 'There are no valid rows, so nothing can be imported.'));
    go.hidden = true;
    return;
  }

  const modeBox = el('fieldset', 'imp-mode');
  modeBox.append(el('legend', undefined, 'How should it be imported?'));
  const mk = (value: 'merge' | 'replace', label: string, hint: string, checked: boolean) => {
    const l = el('label', 'radio');
    const i = el('input');
    i.type = 'radio';
    i.name = 'imp-mode';
    i.value = value;
    i.checked = checked;
    l.append(i, document.createTextNode(` ${label} `), el('span', 'hint', hint));
    return l;
  };
  modeBox.append(
    mk('merge', 'Merge', `add to the ${plural(p.existingCount, 'existing item')}; ${plural(p.duplicates, 'item')} already here will be skipped`, true),
    mk('replace', 'Replace', p.existingCount ? `delete all ${plural(p.existingCount, 'existing item')} first (an automatic backup is saved)` : 'there is no existing feedback', false),
  );
  body.append(modeBox);

  go.textContent = 'Import';
  go.onclick = async () => {
    const mode = (dlg.querySelector<HTMLInputElement>('input[name="imp-mode"]:checked')?.value ?? 'merge') as 'merge' | 'replace';
    go.disabled = true;
    const c = await api('POST', '/api/import/commit', { token: p.token, mode });
    if (!c.ok) {
      go.disabled = false;
      body.append(el('p', 'error', c.data?.error ?? 'The import failed.'));
      return;
    }
    // reload and re-anchor everything that was imported
    await store.load();
    await resolveAnchors();
    store.changed();
    const imported = new Set<string>(c.data.importedIds);
    const orphans = store.orphans().filter((f) => imported.has(f.id));
    report(p, c.data, orphans.length);
  };
}

function report(p: Preview, c: { mode: string; imported: number; duplicates: string[]; conflicts: { row: number; id: string }[]; addedReviewers: string[]; backupPath: string | null }, orphans: number): void {
  const { body, go, cancel } = show();
  $('imp-title').textContent = 'Import finished';
  const out = el('div', 'imp-report');
  out.id = 'imp-report';
  out.append(el('p', 'imp-done', `Imported ${plural(c.imported, 'item')} (${c.mode}).`));
  if (c.backupPath) out.append(el('p', undefined, `Backup of the previous feedback saved to: ${c.backupPath}`));
  if (c.duplicates.length) {
    out.append(el('p', undefined, `${plural(c.duplicates.length, 'duplicate')} skipped (id already present):`), list(c.duplicates));
  }
  if (c.conflicts.length) {
    out.append(
      el('p', 'warn', `${plural(c.conflicts.length, 'row')} skipped because the id belongs to another review:`),
      list(c.conflicts.map((x) => `Row ${x.row}: ${x.id}`)),
    );
  }
  if (p.errors.length) out.append(el('p', 'warn', `${plural(p.errors.length, 'invalid row')} skipped:`), list(p.errors.map((e) => `Row ${e.row}: ${e.message}`)));
  if (c.addedReviewers.length) out.append(el('p', undefined, `Participants added: ${c.addedReviewers.join(', ')}.`));
  if (orphans) out.append(el('p', 'warn', `${plural(orphans, 'imported item')} could not be located in the document (see "Could not locate in document").`));
  body.replaceChildren(out);
  go.hidden = true;
  cancel.textContent = 'Close';
}
