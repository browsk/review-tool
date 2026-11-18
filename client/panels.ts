import { SEVERITY, STATUSES, type Status } from '../src/feedback/model.js';
import { api } from './api.js';
import { confirmDelete, openFeedbackDialog } from './annotate.js';
import { flashItem } from './highlights.js';
import { store, type FeedbackItem } from './store.js';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
const STATUS_CLASS: Record<Status, string> = { Reject: 'reject', 'Accept with conditions': 'cond', Accept: 'accept' };
const GLYPH: Record<Status, string> = { Reject: '✕', 'Accept with conditions': '◐', Accept: '✓' };

type View =
  | { kind: 'items'; title: string; ids: string[] }
  | { kind: 'all' }
  | { kind: 'participants' };

let view: View | null = null;
const filters = { status: '', reviewer: '', sort: 'newest' };

function panel(): HTMLElement {
  return $('side-panel');
}

export function closePanel(): void {
  view = null;
  panel().hidden = true;
}

function open(v: View): void {
  document.dispatchEvent(new CustomEvent('rt:close-panels'));
  view = v;
  panel().hidden = false;
  render();
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function header(title: string): HTMLElement {
  const h = el('div', 'panel-head');
  h.append(el('h2', undefined, title));
  const x = el('button', 'icon', '×');
  x.type = 'button';
  x.setAttribute('aria-label', 'Close panel');
  x.id = 'panel-close';
  x.onclick = closePanel;
  h.append(x);
  return h;
}

function card(f: FeedbackItem, orphan = false): HTMLElement {
  const c = el('article', `fb-card st-${STATUS_CLASS[f.status]}`);
  c.dataset.id = f.id;
  const top = el('div', 'fb-top');
  const badge = el('span', `badge st-${STATUS_CLASS[f.status]}`);
  badge.append(el('span', 'badge-glyph', GLYPH[f.status]), document.createTextNode(` ${f.status}`));
  top.append(badge);
  top.append(el('span', 'fb-who', `${f.reviewerName}${f.reviewerRole === 'author' ? ' (author)' : ''}`));
  top.append(el('time', 'fb-date', fmtDate(f.createdAt)));
  c.append(top);
  if (f.anchor) {
    const q = f.anchor.quote.replace(/￼/g, '[diagram]');
    c.append(el('blockquote', 'fb-quote', q.length > 300 ? `${q.slice(0, 300)}…` : q));
  } else {
    c.append(el('div', 'fb-scope', 'Whole document'));
  }
  if (f.comment) c.append(el('p', 'fb-comment', f.comment));
  const acts = el('div', 'fb-actions');
  const edit = el('button', undefined, 'Edit');
  edit.type = 'button';
  edit.onclick = (e) => {
    e.stopPropagation();
    openFeedbackDialog({ mode: 'edit', item: f });
  };
  const del = el('button', undefined, 'Delete');
  del.type = 'button';
  del.onclick = (e) => {
    e.stopPropagation();
    confirmDelete(f);
  };
  acts.append(edit, del);
  c.append(acts);
  if (f.scope === 'range' && !orphan) {
    c.classList.add('clickable');
    c.title = 'Show this text in the document';
    c.onclick = () => flashItem(f);
  }
  return c;
}

function renderItems(v: Extract<View, { kind: 'items' }>): void {
  const p = panel();
  const items = v.ids.map((id) => store.feedback.find((f) => f.id === id)).filter((f): f is FeedbackItem => !!f);
  p.replaceChildren(header(v.title));
  if (!items.length) {
    p.append(el('p', 'empty', 'No feedback here any more.'));
    return;
  }
  items.sort((a, b) => SEVERITY[b.status] - SEVERITY[a.status] || a.createdEpoch - b.createdEpoch);
  const list = el('div', 'fb-list');
  items.forEach((f) => list.append(card(f)));
  p.append(list);
}

function renderAll(): void {
  const p = panel();
  p.replaceChildren(header(`All feedback (${store.feedback.length})`));
  const bar = el('div', 'fb-filters');
  const st = el('select');
  st.id = 'flt-status';
  st.append(Object.assign(el('option'), { value: '', textContent: 'All statuses' }));
  STATUSES.forEach((s) => st.append(Object.assign(el('option'), { value: s, textContent: s })));
  st.value = filters.status;
  st.onchange = () => ((filters.status = st.value), render());
  const rv = el('select');
  rv.id = 'flt-reviewer';
  rv.append(Object.assign(el('option'), { value: '', textContent: 'All reviewers' }));
  store.participants.forEach((q) => rv.append(Object.assign(el('option'), { value: q.id, textContent: q.name })));
  rv.value = filters.reviewer;
  rv.onchange = () => ((filters.reviewer = rv.value), render());
  const so = el('select');
  so.id = 'flt-sort';
  so.append(Object.assign(el('option'), { value: 'newest', textContent: 'Newest first' }), Object.assign(el('option'), { value: 'oldest', textContent: 'Oldest first' }));
  so.value = filters.sort;
  so.onchange = () => ((filters.sort = so.value), render());
  [st, rv, so].forEach((s) => s.setAttribute('aria-label', s.id));
  bar.append(st, rv, so);
  p.append(bar);

  const match = (f: FeedbackItem) => (!filters.status || f.status === filters.status) && (!filters.reviewer || f.reviewerId === filters.reviewer);
  const dir = filters.sort === 'newest' ? -1 : 1;
  const sorted = (xs: FeedbackItem[]) => xs.filter(match).sort((a, b) => dir * (a.createdEpoch - b.createdEpoch));

  const docItems = sorted(store.feedback.filter((f) => f.scope === 'document'));
  const located = sorted(store.rangeItems().filter((f) => store.resolved.has(f.id)));
  const lost = sorted(store.orphans());
  const group = (title: string, xs: FeedbackItem[], orphan = false) => {
    if (!xs.length) return;
    const g = el('section', 'fb-group');
    g.append(el('h3', undefined, `${title} (${xs.length})`));
    xs.forEach((f) => g.append(card(f, orphan)));
    p.append(g);
  };
  group('Document feedback', docItems);
  group('On the text', located);
  group('Could not locate in document', lost, true);
  if (!docItems.length && !located.length && !lost.length) p.append(el('p', 'empty', 'No feedback matches.'));
}

// ------------------------------------------------------------ participants

function renderParticipants(): void {
  const p = panel();
  p.replaceChildren(header('Participants'));
  const list = el('ul', 'ppl');
  list.id = 'ppl-list';
  for (const q of store.participants) {
    const li = el('li');
    li.append(el('span', 'ppl-name', q.name), el('span', 'ppl-role', q.role));
    if (q.email) li.append(el('span', 'ppl-email', q.email));
    const used = store.feedback.some((f) => f.reviewerId === q.id);
    if (!used) {
      const rm = el('button', 'icon', '×');
      rm.type = 'button';
      rm.setAttribute('aria-label', `Remove ${q.name}`);
      rm.onclick = async () => {
        const r = await api('DELETE', `/api/participants/${q.id}`);
        if (r.ok) store.setParticipants(r.data.participants);
      };
      li.append(rm);
    }
    list.append(li);
  }
  if (!store.participants.length) p.append(el('p', 'empty', 'No participants yet. Add people below or import a file.'));
  p.append(list);
  const authors = store.participants.filter((q) => q.role === 'author').length;
  if (store.participants.length && authors !== 1) {
    p.append(el('p', 'warn', `Exactly one author is expected; found ${authors}.`));
  }

  const form = el('form', 'ppl-add');
  form.id = 'ppl-form';
  const name = el('input');
  name.id = 'ppl-name';
  name.placeholder = 'Name';
  name.setAttribute('aria-label', 'Name');
  const email = el('input');
  email.id = 'ppl-email';
  email.placeholder = 'Email (optional)';
  email.setAttribute('aria-label', 'Email');
  const role = el('select');
  role.id = 'ppl-role';
  role.setAttribute('aria-label', 'Role');
  role.append(Object.assign(el('option'), { value: 'reviewer', textContent: 'reviewer' }), Object.assign(el('option'), { value: 'author', textContent: 'author' }));
  const add = el('button', undefined, 'Add');
  add.type = 'submit';
  const err = el('p', 'error');
  err.id = 'ppl-error';
  err.hidden = true;
  form.append(name, email, role, add, err);
  form.onsubmit = async (e) => {
    e.preventDefault();
    err.hidden = true;
    const r = await api('POST', '/api/participants', { name: name.value, email: email.value, role: role.value });
    if (r.ok) store.setParticipants(r.data.participants);
    else {
      err.textContent = String(Object.values(r.data?.errors ?? { e: r.data?.error ?? 'Could not add.' })[0]);
      err.hidden = false;
    }
  };
  p.append(el('h3', undefined, 'Add a participant'), form);

  const imp = el('div', 'ppl-import');
  imp.append(el('h3', undefined, 'Import from file'), el('p', 'hint', 'CSV or JSON with a name column; email and role (author or reviewer) are optional.'));
  const file = el('input');
  file.type = 'file';
  file.accept = '.csv,.json,text/csv,application/json';
  file.id = 'ppl-file';
  file.setAttribute('aria-label', 'Participant file');
  const report = el('div', 'ppl-report');
  report.id = 'ppl-report';
  report.setAttribute('role', 'status');
  file.onchange = async () => {
    const f = file.files?.[0];
    report.replaceChildren();
    if (!f) return;
    const r = await api('POST', '/api/participants/import', { filename: f.name, content: await f.text() });
    file.value = '';
    if (!r.ok) {
      const bad = el('div', 'error');
      bad.append(el('strong', undefined, `Could not import ${f.name}`));
      if (r.data?.fatal) bad.append(el('p', undefined, r.data.fatal));
      const ul = el('ul');
      for (const e of (r.data?.errors ?? []) as { row: number; message: string }[]) ul.append(el('li', undefined, `Row ${e.row}: ${e.message}`));
      bad.append(ul);
      report.append(bad);
      return;
    }
    const ok = el('div');
    ok.append(el('p', undefined, `Imported ${r.data.added.length} participant${r.data.added.length === 1 ? '' : 's'}.`));
    if (r.data.skipped.length) ok.append(el('p', 'hint', `Already present, skipped: ${r.data.skipped.join(', ')}`));
    for (const w of r.data.warnings as string[]) ok.append(el('p', 'warn', w));
    store.setParticipants(r.data.participants); // re-renders the panel...
    $('ppl-report')?.replaceChildren(ok); // ...so write the report into the new element
  };
  imp.append(file, report);
  p.append(imp);
}

// ------------------------------------------------------------ wiring

function render(): void {
  if (!view || panel().hidden) return;
  const report = view.kind === 'participants' ? $('ppl-report')?.innerHTML : undefined;
  const focus = document.activeElement?.id;
  if (view.kind === 'items') renderItems(view);
  else if (view.kind === 'all') renderAll();
  else renderParticipants();
  if (report && $('ppl-report')) $('ppl-report').innerHTML = report;
  if (focus) document.getElementById(focus)?.focus();
  const n = $('all-count');
  if (n) n.textContent = String(store.feedback.length);
}

export function initPanels(): void {
  $('btn-all-feedback')?.addEventListener('click', () => (view?.kind === 'all' && !panel().hidden ? closePanel() : open({ kind: 'all' })));
  $('btn-participants')?.addEventListener('click', () => (view?.kind === 'participants' && !panel().hidden ? closePanel() : open({ kind: 'participants' })));
  document.addEventListener('rt:show-items', (e) => {
    const d = (e as CustomEvent<{ title: string; ids: string[] }>).detail;
    open({ kind: 'items', title: d.title, ids: d.ids });
  });
  document.addEventListener('rt:close-panels', () => {
    if (!panel().hidden) closePanel();
  });
  store.addEventListener('change', () => {
    const n = $('all-count');
    if (n) n.textContent = String(store.feedback.length);
    render();
  });
  const n = $('all-count');
  if (n) n.textContent = String(store.feedback.length);
}
