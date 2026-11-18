import { buildTextModel, offsetOf, rangeFor, type TextModel } from '../src/shared/textmodel.js';
import { sectionsOf, validateSelection, type SectionInfo } from '../src/shared/sectionrules.js';
import { reanchor, reanchorDiagram } from '../src/shared/anchor.js';
import { SEVERITY, type Status } from '../src/feedback/model.js';
import { api } from './api.js';
import { assignLayers } from '../src/shared/layers.js';
import { store, type FeedbackItem, type Resolved } from './store.js';
import { setClientDiagnostics, type ClientDiag } from './diagnostics.js';

const KEY = 'rt-hl';
const STATUS_KEY: Record<Status, string> = { Reject: 'reject', 'Accept with conditions': 'cond', Accept: 'accept' };
const GLYPH: Record<Status, string> = { Reject: '✕', 'Accept with conditions': '◐', Accept: '✓' };

let docEl: HTMLElement;
let model: TextModel;
let sections: SectionInfo[] = [];
let visible = true;
const hl = (): HighlightRegistry | undefined => (typeof CSS !== 'undefined' ? (CSS as any).highlights : undefined);

export const getModel = () => model;
export const getSections = () => sections;
export const highlightsSupported = () => !!hl() && typeof (globalThis as any).Highlight !== 'undefined';

interface HighlightRegistry {
  set(name: string, h: unknown): void;
  delete(name: string): void;
}

export function highlightsVisible(): boolean {
  return visible;
}

export function setHighlightsVisible(v: boolean): void {
  visible = v;
  try {
    localStorage.setItem(KEY, v ? '1' : '0');
  } catch {
    /* storage unavailable */
  }
  document.documentElement.classList.toggle('hl-hidden', !v);
  draw();
}

export function initModel(el: HTMLElement): void {
  docEl = el;
  model = buildTextModel(el);
  sections = sectionsOf(model);
  try {
    visible = localStorage.getItem(KEY) !== '0';
  } catch {
    visible = true;
  }
  document.documentElement.classList.toggle('hl-hidden', !visible);
}

/** Re-attach every range item to the current text; persist moved offsets; collect orphans. */
export async function resolveAnchors(): Promise<void> {
  store.resolved.clear();
  const updates: { id: string; start: number; end: number }[] = [];
  const diags: ClientDiag[] = [];
  for (const f of store.rangeItems()) {
    const a = f.anchor!;
    // feedback on a whole diagram is found by its source text; everything else by its quoted text
    const r = a.kind === 'diagram' ? reanchorDiagram(model.diagrams, a) : reanchor(model.text, a);
    if (!r) continue;
    store.resolved.set(f.id, { start: r.start, end: r.end });
    if (r.start !== a.start || r.end !== a.end) {
      updates.push({ id: f.id, start: r.start, end: r.end });
      a.start = r.start;
      a.end = r.end;
    }
    const check = validateSelection(sections, r.start, r.end);
    if (!check.ok && check.reason === 'spans-sections') {
      diags.push({ severity: 'warning', message: `Feedback by ${f.reviewerName} now spans more than one section ("${check.from.heading}" and "${check.to.heading}").` });
    }
  }
  const orphans = store.orphans();
  if (orphans.length) {
    diags.push({
      severity: 'warning',
      message: `${orphans.length} feedback item${orphans.length === 1 ? '' : 's'} could not be located in the document (see "Could not locate in document" in the feedback panel).`,
    });
  }
  if (!highlightsSupported()) {
    diags.push({ severity: 'warning', message: 'This browser does not support the CSS Custom Highlight API; text highlights are unavailable (margin markers still work).' });
  }
  setClientDiagnostics('feedback', diags);
  if (updates.length || store.needsReanchor) {
    await api('POST', '/api/session/reanchor', { sha256: store.sha256, updates });
    store.needsReanchor = false;
  }
}

// ---------------------------------------------------------------- drawing

function rangesFor(items: FeedbackItem[]): Range[] {
  const out: Range[] = [];
  for (const f of items) {
    const r = store.resolved.get(f.id);
    if (!r) continue;
    const range = rangeFor(model, r.start, r.end);
    if (range) out.push(range);
  }
  return out;
}

let markers: { el: HTMLElement; block: TextModel['blocks'][number]; ids: string[] }[] = [];
let layoutQueued = false;

let registered: string[] = [];

export function draw(): void {
  const reg = hl();
  const HighlightCtor = (globalThis as any).Highlight;
  if (reg && HighlightCtor) {
    for (const name of registered) reg.delete(name);
    registered = [];
    if (visible) {
      // Each Highlight object paints once, so overlapping ranges go into different layers: their
      // translucent tints then stack (overlap deepens). Priority = severity so the most severe status
      // wins the underline where ranges overlap.
      // (diagram feedback has no text to tint: it gets an outline on the diagram, see markDiagrams)
      const located = store.rangeItems().filter((f) => store.resolved.has(f.id) && f.anchor?.kind !== 'diagram');
      const layers = assignLayers(located.map((f) => ({ id: f.id, ...(store.resolved.get(f.id) as Resolved) })));
      const groups = new Map<string, FeedbackItem[]>();
      for (const f of located) {
        const key = `rt-${STATUS_KEY[f.status]}-${layers.get(f.id) ?? 0}`;
        (groups.get(key) ?? groups.set(key, []).get(key)!).push(f);
      }
      for (const [name, items] of groups) {
        const rs = rangesFor(items);
        if (!rs.length) continue;
        const h = new HighlightCtor(...rs);
        h.priority = SEVERITY[items[0]!.status] * 10 + (layers.get(items[0]!.id) ?? 0);
        reg.set(name, h);
        registered.push(name);
      }
    }
  }
  markDiagrams();
  buildMarkers();
}

/** Status-coloured outline (and a count) on each diagram that has feedback. */
function markDiagrams(): void {
  for (const d of model.diagrams) {
    const items = visible ? diagramItems(d.el) : [];
    if (!items.length) {
      delete (d.el as HTMLElement).dataset.fb;
      delete (d.el as HTMLElement).dataset.fbCount;
      continue;
    }
    const worst = items.reduce((m, f) => (SEVERITY[f.status] > SEVERITY[m] ? f.status : m), items[0]!.status);
    (d.el as HTMLElement).dataset.fb = STATUS_KEY[worst];
    (d.el as HTMLElement).dataset.fbCount = String(items.length);
  }
}

/** Feedback items anchored to this diagram block. */
export function diagramItems(el: Element): FeedbackItem[] {
  const d = model.diagrams.find((x) => x.el === el);
  if (!d) return [];
  return store
    .rangeItems()
    .filter((f) => f.anchor?.kind === 'diagram' && store.resolved.get(f.id)?.start === d.start)
    .sort((a, b) => SEVERITY[b.status] - SEVERITY[a.status] || a.createdEpoch - b.createdEpoch);
}

function buildMarkers(): void {
  const layer = document.getElementById('margin-layer');
  if (!layer) return;
  layer.replaceChildren();
  markers = [];
  if (!visible) return;
  const items = store.rangeItems().filter((f) => store.resolved.has(f.id));
  if (!items.length) return;
  const spans = items.map((f) => ({ f, ...(store.resolved.get(f.id) as { start: number; end: number }) })).sort((a, b) => a.start - b.start);
  // text blocks plus diagram blocks (a diagram's placeholder character is its extent in the text model)
  const blocks = [...model.blocks, ...model.diagrams.map((d) => ({ el: d.el, start: d.start, end: d.end }))];
  for (const block of blocks) {
    const hit = spans.filter((s) => s.start < block.end && s.end > block.start);
    if (!hit.length) continue;
    const worst = hit.reduce((m, s) => (SEVERITY[s.f.status] > SEVERITY[m] ? s.f.status : m), hit[0]!.f.status);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `fb-marker mk-${STATUS_KEY[worst]}`;
    btn.dataset.noAnchor = '';
    btn.setAttribute('aria-label', `${hit.length} feedback item${hit.length === 1 ? '' : 's'} in this block, most severe: ${worst}`);
    btn.title = `${hit.length} feedback item${hit.length === 1 ? '' : 's'}`;
    const g = document.createElement('span');
    g.className = 'mk-glyph';
    g.textContent = GLYPH[worst];
    const n = document.createElement('span');
    n.className = 'mk-count';
    n.textContent = String(hit.length);
    btn.append(g, n);
    const ids = hit.map((s) => s.f.id);
    btn.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('rt:show-items', { detail: { title: 'Feedback in this block', ids } }));
    });
    layer.append(btn);
    markers.push({ el: btn, block, ids });
  }
  layoutMarkers();
}

export function layoutMarkers(): void {
  const layer = document.getElementById('margin-layer');
  if (!layer || !markers.length) return;
  const base = layer.getBoundingClientRect();
  const docRect = docEl.getBoundingClientRect();
  // batch reads, then writes
  const tops = markers.map((m) => m.block.el.getBoundingClientRect().top - base.top);
  const left = Math.max(2, docRect.left - base.left - 46);
  markers.forEach((m, i) => {
    m.el.style.top = `${tops[i]}px`;
    m.el.style.left = `${left}px`;
  });
}

export function queueLayout(): void {
  if (layoutQueued) return;
  layoutQueued = true;
  requestAnimationFrame(() => {
    layoutQueued = false;
    layoutMarkers();
  });
}

// ---------------------------------------------------------------- hit testing

function caretOffset(x: number, y: number): number | null {
  let node: Node | null = null;
  let off = 0;
  const d = document as any;
  if (d.caretPositionFromPoint) {
    const p = d.caretPositionFromPoint(x, y);
    if (p) {
      node = p.offsetNode;
      off = p.offset;
    }
  } else if (d.caretRangeFromPoint) {
    const r = d.caretRangeFromPoint(x, y);
    if (r) {
      node = r.startContainer;
      off = r.startOffset;
    }
  }
  if (!node || !docEl.contains(node)) return null;
  return offsetOf(model, node, off, 'start');
}

/** Feedback items whose highlighted text is under the point. */
export function itemsAtPoint(x: number, y: number): FeedbackItem[] {
  if (!visible) return [];
  const off = caretOffset(x, y);
  if (off === null) return [];
  const out: FeedbackItem[] = [];
  for (const f of store.rangeItems()) {
    const r = store.resolved.get(f.id);
    if (!r || off < r.start - 1 || off > r.end + 1) continue;
    const range = rangeFor(model, r.start, r.end);
    if (!range) continue;
    for (const rect of Array.from(range.getClientRects())) {
      if (x >= rect.left - 1 && x <= rect.right + 1 && y >= rect.top - 1 && y <= rect.bottom + 1) {
        out.push(f);
        break;
      }
    }
  }
  return out.sort((a, b) => SEVERITY[b.status] - SEVERITY[a.status] || a.createdEpoch - b.createdEpoch);
}

let flashTimer = 0;
export function flashItem(item: FeedbackItem): void {
  const r = store.resolved.get(item.id);
  if (!r) return;
  const range = rangeFor(model, r.start, r.end);
  if (!range) return;
  const start = range.startContainer.parentElement;
  start?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
  const reg = hl();
  const HighlightCtor = (globalThis as any).Highlight;
  if (!reg || !HighlightCtor) return;
  const h = new HighlightCtor(range);
  h.priority = 100;
  reg.set('rt-flash', h);
  clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => reg.delete('rt-flash'), 1800);
}

// ---------------------------------------------------------------- interaction

export function initHighlightInteraction(): void {
  const tip = document.getElementById('hl-tooltip');
  let raf = 0;
  let lastX = 0;
  let lastY = 0;

  const hideTip = () => {
    if (tip) tip.hidden = true;
    docEl.classList.remove('over-feedback');
  };

  docEl.addEventListener('mousemove', (e) => {
    lastX = e.clientX;
    lastY = e.clientY;
    if (e.buttons !== 0) return hideTip();
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const items = itemsAtPoint(lastX, lastY);
      if (!tip || !items.length) return hideTip();
      docEl.classList.add('over-feedback');
      const lines = items.slice(0, 3).map((f) => `${f.status} – ${f.reviewerName}${f.comment ? `: ${f.comment.slice(0, 80)}${f.comment.length > 80 ? '…' : ''}` : ''}`);
      if (items.length > 3) lines.push(`+${items.length - 3} more`);
      tip.replaceChildren(...lines.map((l) => Object.assign(document.createElement('div'), { textContent: l })));
      tip.hidden = false;
      tip.style.left = `${Math.min(lastX + 14, window.innerWidth - 340)}px`;
      tip.style.top = `${lastY + 18}px`;
    });
  });
  docEl.addEventListener('mouseleave', hideTip);

  docEl.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a')) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    const items = itemsAtPoint(e.clientX, e.clientY);
    if (!items.length) return;
    document.dispatchEvent(new CustomEvent('rt:show-items', { detail: { title: 'Feedback on this text', ids: items.map((i) => i.id) } }));
  });

  document.addEventListener('rt:diagram-click', (e) => {
    const items = diagramItems((e as CustomEvent<Element>).detail);
    if (items.length) document.dispatchEvent(new CustomEvent('rt:show-items', { detail: { title: 'Feedback on this diagram', ids: items.map((i) => i.id) } }));
  });

  new ResizeObserver(queueLayout).observe(docEl);
  window.addEventListener('resize', queueLayout);
  document.addEventListener('rt:layout', queueLayout);
  window.addEventListener('load', queueLayout);
  store.addEventListener('change', draw);
}
