import { offsetOf, quoteFor } from '../src/shared/textmodel.js';
import { displayName, validateSelection } from '../src/shared/sectionrules.js';
import { STATUSES, commentRequired, type Status } from '../src/feedback/model.js';
import { api } from './api.js';
import { getModel, getSections } from './highlights.js';
import { store, type FeedbackItem, type Participant } from './store.js';

type Anchor = NonNullable<FeedbackItem['anchor']>;

let docEl: HTMLElement;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ------------------------------------------------------------------ selection capture

interface Pending {
  anchor: Anchor;
}
let pending: Pending | null = null;

function ui() {
  return { box: $('sel-ui'), add: $<HTMLButtonElement>('sel-add'), msg: $('sel-msg') };
}

function hideSelectionUi(): void {
  const { box, add, msg } = ui();
  box.hidden = true;
  add.hidden = true;
  msg.hidden = true;
  msg.textContent = '';
  pending = null;
}

function placeNear(rect: DOMRect): void {
  const { box } = ui();
  box.hidden = false;
  const w = box.offsetWidth || 160;
  box.style.top = `${Math.min(window.innerHeight - 48, rect.bottom + 8)}px`;
  box.style.left = `${Math.max(8, Math.min(rect.right - w / 2, window.innerWidth - w - 12))}px`;
}

function evaluateSelection(): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return hideSelectionUi();
  const r = sel.getRangeAt(0);
  // selections that begin or end in app chrome are ignored
  if (!docEl.contains(r.startContainer) || !docEl.contains(r.endContainer)) return hideSelectionUi();
  const model = getModel();
  let s = offsetOf(model, r.startContainer, r.startOffset, 'start');
  let e = offsetOf(model, r.endContainer, r.endOffset, 'end');  if (s === null || e === null) return hideSelectionUi();
  // trim leading/trailing whitespace (triple-click selects the trailing line break)
  while (s < e && /\s/.test(model.text[s] as string)) s++;
  while (e > s && /\s/.test(model.text[e - 1] as string)) e--;
  if (e <= s) return hideSelectionUi(); // collapsed or whitespace-only
  const check = validateSelection(getSections(), s, e);
  const { add, msg } = ui();
  hideSelectionUi();
  placeNear(r.getBoundingClientRect());
  if (check.ok) {
    const q = quoteFor(model, s, e);
    const inside = model.diagrams.filter((d) => d.start >= s && d.end <= e);
    // a selection that is exactly one diagram (e.g. text selected inside its SVG snaps to the whole block)
    const wholeDiagram = inside.length === 1 && q.quote.replace(/￼/g, '').trim() === '';
    pending = {
      anchor: wholeDiagram
        ? { start: inside[0]!.start, end: inside[0]!.end, quote: inside[0]!.source, prefix: '', suffix: '', sectionHeading: check.section.heading, kind: 'diagram' }
        : { start: s, end: e, quote: q.quote, prefix: q.prefix, suffix: q.suffix, sectionHeading: check.section.heading, kind: 'text' },
    };
    add.hidden = false;
  } else if (check.reason === 'spans-sections') {
    msg.textContent = `Feedback can cover at most one section. This selection spans '${displayName(check.from)}' and '${displayName(check.to)}'.`;
    msg.hidden = false;
  } else {
    hideSelectionUi();
  }
}

export function initSelection(el: HTMLElement): void {
  docEl = el;
  const { box, add } = ui();
  let raf = 0;
  const schedule = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(evaluateSelection);
  };
  document.addEventListener('mouseup', (e) => {
    if (box.contains(e.target as Node)) return;
    schedule();
  });
  document.addEventListener('keyup', (e) => {
    if (e.shiftKey || e.key === 'Shift') schedule();
  });
  // dismiss on the next click or new selection start
  document.addEventListener('mousedown', (e) => {
    if (!box.contains(e.target as Node)) hideSelectionUi();
  });
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) hideSelectionUi();
  });
  // keep the selection when pressing the button
  box.addEventListener('mousedown', (e) => e.preventDefault());
  add.addEventListener('click', () => {
    if (!pending) return;
    const anchor = pending.anchor;
    hideSelectionUi();
    openFeedbackDialog({ mode: 'create', anchor });
  });
  // the hover button on a diagram: feedback anchored to the whole diagram block (quote = its source)
  document.addEventListener('rt:diagram-feedback', (e) => {
    const model = getModel();
    const d = model.diagrams.find((x) => x.el === (e as CustomEvent<Element>).detail);
    if (!d) return;
    const check = validateSelection(getSections(), d.start, d.end);
    hideSelectionUi();
    openFeedbackDialog({
      mode: 'create',
      anchor: { start: d.start, end: d.end, quote: d.source, prefix: '', suffix: '', sectionHeading: check.ok ? check.section.heading : '', kind: 'diagram' },
    });
  });
}

// ------------------------------------------------------------------ feedback dialog

/** create with anchor = range feedback; create with anchor null = whole-document feedback */
type DialogOpts = { mode: 'create'; anchor: Anchor | null } | { mode: 'edit'; item: FeedbackItem };

export function openFeedbackDialog(opts: DialogOpts): void {
  const dlg = $<HTMLDialogElement>('fb-dialog');
  const form = $<HTMLFormElement>('fb-form');
  const quote = $('fb-quote');
  const sel = $<HTMLSelectElement>('fb-reviewer');
  const newBox = $('fb-newreviewer');
  const newName = $<HTMLInputElement>('fb-newname');
  const newRole = $<HTMLSelectElement>('fb-newrole');
  const comment = $<HTMLTextAreaElement>('fb-comment');
  const err = $('fb-error');
  const req = $('fb-req');
  const saveBtn = $<HTMLButtonElement>('fb-save');

  const anchor = opts.mode === 'create' ? opts.anchor : opts.item.anchor;
  $('fb-title').textContent = opts.mode === 'edit' ? 'Edit feedback' : anchor ? 'Add feedback' : 'Add document feedback';
  quote.hidden = !anchor;
  quote.textContent = anchor ? anchor.quote.replace(/￼/g, '[diagram]') : '';
  err.hidden = true;
  err.textContent = '';

  const fillReviewers = (selectedId: string | null) => {
    sel.replaceChildren(
      ...store.participants.map((p: Participant) => Object.assign(document.createElement('option'), { value: p.id, textContent: `${p.name} (${p.role})` })),
      Object.assign(document.createElement('option'), { value: '__new__', textContent: 'Add new participant…' }),
    );
    const want = selectedId && store.participants.some((p) => p.id === selectedId) ? selectedId : store.participants[0]?.id ?? '__new__';
    sel.value = want;
    syncNew();
  };
  const syncNew = () => {
    newBox.hidden = sel.value !== '__new__';
  };
  sel.onchange = syncNew;

  const defaultReviewer = opts.mode === 'edit' ? opts.item.reviewerId : store.lastReviewerId;
  fillReviewers(defaultReviewer);
  newName.value = '';
  newRole.value = 'reviewer';

  const status = (v: Status | '') => {
    form.querySelectorAll<HTMLInputElement>('input[name="status"]').forEach((r) => (r.checked = r.value === v));
  };
  status(opts.mode === 'edit' ? opts.item.status : '');
  comment.value = opts.mode === 'edit' ? opts.item.comment : '';

  const syncRequired = () => {
    const s = (form.querySelector<HTMLInputElement>('input[name="status"]:checked')?.value ?? '') as Status | '';
    req.textContent = s && commentRequired(s) ? '(required)' : '(optional)';
  };
  form.querySelectorAll<HTMLInputElement>('input[name="status"]').forEach((r) => (r.onchange = syncRequired));
  syncRequired();

  const close = () => dlg.close();
  $('fb-cancel').onclick = close;

  form.onsubmit = async (ev) => {
    ev.preventDefault();
    err.hidden = true;
    const s = form.querySelector<HTMLInputElement>('input[name="status"]:checked')?.value as Status | undefined;
    const fail = (m: string) => {
      err.textContent = m;
      err.hidden = false;
    };
    if (!s || !(STATUSES as readonly string[]).includes(s)) return fail('Please choose a status.');
    if (commentRequired(s) && !comment.value.trim()) return fail(`A comment is required for "${s}".`);
    saveBtn.disabled = true;
    try {
      let reviewerId = sel.value;
      if (reviewerId === '__new__') {
        const name = newName.value.trim();
        if (!name) return fail('Please enter the new participant’s name.');
        const pr = await api('POST', '/api/participants', { name, role: newRole.value });
        if (!pr.ok) return fail(pr.data?.errors?.name ?? pr.data?.errors?.role ?? 'Could not add the participant.');
        store.setParticipants(pr.data.participants);
        reviewerId = pr.data.participant.id;
      }
      if (opts.mode === 'create') {
        const a = opts.anchor;
        const r = await api('POST', '/api/feedback', a
          ? { scope: 'range', status: s, comment: comment.value, reviewerId, anchor: a }
          : { scope: 'document', status: s, comment: comment.value, reviewerId });
        if (!r.ok) return fail(firstError(r.data));
        store.upsert(r.data.feedback, a ? { start: a.start, end: a.end } : undefined);
        if (a) window.getSelection()?.removeAllRanges();
      } else {
        const r = await api('PATCH', `/api/feedback/${opts.item.id}`, { status: s, comment: comment.value, reviewerId });
        if (!r.ok) return fail(firstError(r.data));
        store.upsert(r.data.feedback);
      }
      close();
    } finally {
      saveBtn.disabled = false;
    }
  };

  dlg.showModal();
  (opts.mode === 'create' ? form.querySelector<HTMLInputElement>('input[name="status"]') : comment)?.focus();
}

function firstError(data: any): string {
  if (data?.errors) return String(Object.values(data.errors)[0]);
  return data?.error ?? 'Something went wrong.';
}

export function confirmDelete(item: FeedbackItem): void {
  const dlg = $<HTMLDialogElement>('confirm-dialog');
  $('confirm-text').textContent = `Delete the ${item.status} feedback from ${item.reviewerName}? This cannot be undone.`;
  $('confirm-no').onclick = () => dlg.close();
  $('confirm-yes').onclick = async () => {
    const r = await api('DELETE', `/api/feedback/${item.id}`);
    if (r.ok) store.remove(item.id);
    dlg.close();
  };
  dlg.showModal();
}
