/**
 * Normalised rendered-text model (version 1).
 *
 * Offsets used for feedback anchors are UTF-16 indices into `model.text`, built from the rendered DOM:
 *  - text of every text node in document order, excluding <script>/<style> and any subtree marked
 *    `data-no-anchor` (app chrome, injected UI);
 *  - whitespace runs outside <pre> collapse to one space; leading/trailing whitespace of a block is dropped;
 *  - <pre> text is kept verbatim; <br> emits "\n";
 *  - block boundaries emit one "\n"; table cells in a row are separated by one space;
 *  - a diagram block (`data-diagram-lang`) contributes exactly one placeholder character U+FFFC and its
 *    inner SVG/text is excluded.
 * Changing any of these rules requires bumping TEXTMODEL_VERSION in src/feedback/model.ts.
 */

export const DIAGRAM_PLACEHOLDER = '￼';

const BLOCK_TAGS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'CAPTION', 'DD', 'DETAILS', 'DIV', 'DL', 'DT', 'FIELDSET', 'FIGCAPTION',
  'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE',
  'SECTION', 'SUMMARY', 'TABLE', 'TBODY', 'TFOOT', 'THEAD', 'TR', 'UL',
]);
const CELL_TAGS = new Set(['TD', 'TH']);
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT']);
const isWs = (c: string) => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f';

export interface BlockInfo {
  el: Element;
  /** normalised offsets of the first and one-past-last character owned by this block */
  start: number;
  end: number;
}

export interface NodeEntry {
  node: Text;
  /** normalised offset of the first emitted character */
  start: number;
  /** raw index in node.data for each emitted character (increasing) */
  rawIdx: number[];
  sectionId: string | null;
  block: BlockInfo | null;
}

export interface DiagramInfo {
  el: Element;
  start: number;
  end: number;
}

export interface TextModel {
  root: Element;
  text: string;
  entries: NodeEntry[];
  blocks: BlockInfo[];
  diagrams: DiagramInfo[];
  byNode: Map<Text, NodeEntry>;
}

function closestBlock(el: Element | null, root: Element): Element | null {
  for (let e = el; e && e !== root.parentElement; e = e.parentElement) {
    if (BLOCK_TAGS.has(e.tagName) || CELL_TAGS.has(e.tagName)) return e;
  }
  return null;
}

export function buildTextModel(root: Element): TextModel {
  let out = '';
  const entries: NodeEntry[] = [];
  const blocks: BlockInfo[] = [];
  const diagrams: DiagramInfo[] = [];
  const blockOf = new Map<Element, BlockInfo>();
  let pendingBreak = false;
  let pendingSep = false;
  let pendingSpace: { entry: NodeEntry; raw: number } | null = null;

  const touch = (b: NodeEntry['block']) => {
    if (b) b.end = out.length;
  };

  function pushChar(ch: string, entry: NodeEntry, raw: number) {
    if (entry.rawIdx.length === 0) entry.start = out.length;
    out += ch;
    entry.rawIdx.push(raw);
    if (entry.block && entry.block.start < 0) entry.block.start = out.length - 1;
    touch(entry.block);
  }

  function flush() {
    if (pendingBreak) {
      if (out.length && !out.endsWith('\n')) out += '\n';
    } else if (pendingSpace || pendingSep) {
      const last = out[out.length - 1];
      if (out.length && last !== ' ' && last !== '\n') {
        if (pendingSpace) pushChar(' ', pendingSpace.entry, pendingSpace.raw);
        else out += ' ';
      }
    }
    pendingBreak = false;
    pendingSep = false;
    pendingSpace = null;
  }

  function walk(node: Node) {
    if (node.nodeType === 3) {
      const t = node as Text;
      const parent = t.parentElement;
      const blockEl = closestBlock(parent, root);
      let block: BlockInfo | null = null;
      if (blockEl) {
        block = blockOf.get(blockEl) ?? null;
        if (!block) {
          block = { el: blockEl, start: -1, end: -1 };
          blockOf.set(blockEl, block);
          blocks.push(block);
        }
      }
      const entry: NodeEntry = {
        node: t,
        start: -1,
        rawIdx: [],
        sectionId: parent?.closest('[data-section-id]')?.getAttribute('data-section-id') ?? null,
        block,
      };
      entries.push(entry);
      const inPre = !!parent?.closest('pre');
      const data = t.data;
      for (let i = 0; i < data.length; i++) {
        const ch = data[i] as string;
        if (!inPre && isWs(ch)) {
          if (!pendingSpace) pendingSpace = { entry, raw: i };
          continue;
        }
        flush();
        pushChar(ch, entry, i);
      }
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    if (SKIP_TAGS.has(el.tagName) || el.hasAttribute('data-no-anchor')) return;
    if (el.hasAttribute('data-diagram-lang')) {
      pendingBreak = true;
      flush();
      diagrams.push({ el, start: out.length, end: out.length + 1 });
      out += DIAGRAM_PLACEHOLDER;
      pendingBreak = true;
      return;
    }
    if (el.tagName === 'BR') {
      out += '\n';
      pendingBreak = false;
      pendingSpace = null;
      pendingSep = false;
      return;
    }
    const block = BLOCK_TAGS.has(el.tagName);
    const cell = CELL_TAGS.has(el.tagName);
    if (block) pendingBreak = true;
    else if (cell) pendingSep = true;
    for (let c = el.firstChild; c; c = c.nextSibling) walk(c);
    if (block) pendingBreak = true;
    else if (cell) pendingSep = true;
  }

  walk(root);
  const kept = entries.filter((e) => e.rawIdx.length > 0);
  return {
    root,
    text: out,
    entries: kept,
    blocks: blocks.filter((b) => b.start >= 0),
    diagrams,
    byNode: new Map(kept.map((e) => [e.node, e])),
  };
}

/** Index of the first entry with start + length > offset (binary search). */
function firstEntryEnding(model: TextModel, offset: number): number {
  let lo = 0;
  let hi = model.entries.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const e = model.entries[mid] as NodeEntry;
    if (e.start + e.rawIdx.length > offset) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

function lowerBound(arr: number[], v: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((arr[mid] as number) < v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Map a DOM point to a normalised offset. `edge` says which side of a diagram a point inside it
 * snaps to. Returns null when the point is in excluded content (app chrome, injected UI).
 */
export function offsetOf(model: TextModel, node: Node, offset: number, edge: 'start' | 'end'): number | null {
  const el = node.nodeType === 1 ? (node as Element) : node.parentElement;
  const diagram = el?.closest('[data-diagram-lang]');
  if (diagram && model.root.contains(diagram)) {
    const d = model.diagrams.find((x) => x.el === diagram);
    return d ? (edge === 'start' ? d.start : d.end) : null;
  }
  if (node.nodeType === 3) {
    const entry = model.byNode.get(node as Text);
    if (!entry) return null;
    const i = lowerBound(entry.rawIdx, offset);
    return entry.start + i;
  }
  if (!model.root.contains(node)) return null;
  // element boundary: the point sits before child[offset]; find the first entry at/after it
  const doc = node.ownerDocument as Document;
  const r = doc.createRange();
  r.setStart(node, offset);
  r.collapse(true);
  for (const e of model.entries) {
    // comparePoint: 0 when equal, 1 when the point is after the range start
    if (r.comparePoint(e.node, 0) >= 0) {
      // the first character of the entry that begins at/after the boundary
      return e.start;
    }
  }
  return model.text.length;
}

/** Build a DOM Range for [start, end) of normalised text, or null if it covers no text. */
export function rangeFor(model: TextModel, start: number, end: number): Range | null {
  if (end <= start || start < 0 || end > model.text.length) return null;
  const si = firstEntryEnding(model, start);
  const s = model.entries[si];
  if (!s) return null;
  const sRaw = start >= s.start ? (s.rawIdx[start - s.start] as number) : (s.rawIdx[0] as number);
  // last entry that starts before `end`
  let ei = firstEntryEnding(model, end - 1);
  let e = model.entries[ei];
  if (!e || e.start >= end) {
    ei = Math.max(0, ei - 1);
    e = model.entries[ei];
  }
  if (!e) return null;
  const idx = Math.min(e.rawIdx.length - 1, Math.max(0, end - 1 - e.start));
  const eRaw = (e.rawIdx[idx] as number) + 1;
  if (ei < si) return null;
  const range = (model.root.ownerDocument as Document).createRange();
  range.setStart(s.node, sRaw);
  range.setEnd(e.node, Math.min(eRaw, e.node.length));
  return range.collapsed ? null : range;
}

export interface QuoteParts {
  quote: string;
  prefix: string;
  suffix: string;
}

export function quoteFor(model: TextModel, start: number, end: number): QuoteParts {
  return {
    quote: model.text.slice(start, end),
    prefix: model.text.slice(Math.max(0, start - 32), start),
    suffix: model.text.slice(end, end + 32),
  };
}
