export interface AnchorLike {
  start: number;
  end: number;
  quote: string;
  prefix: string;
  suffix: string;
}

export type Method = 'offset' | 'quote' | 'context' | 'nearest';
export type ReanchorResult = { start: number; end: number; method: Method } | null;

export interface DiagramTarget {
  start: number;
  end: number;
  source: string;
}

/**
 * Re-attach feedback on a whole diagram. The quote is the diagram's source text, so the diagram is found by
 * matching sources (CRLF- and trailing-whitespace-insensitive). If several diagrams have identical source, the
 * one nearest the old offset wins.
 */
export function reanchorDiagram(diagrams: DiagramTarget[], a: { start: number; quote: string }): { start: number; end: number; method: 'diagram' } | null {
  const norm = (s: string) => s.replace(/\r\n?/g, '\n').trimEnd();
  const q = norm(a.quote);
  if (!q) return null;
  const hits = diagrams.filter((d) => norm(d.source) === q);
  if (!hits.length) return null;
  const best = hits.reduce((m, d) => (Math.abs(d.start - a.start) < Math.abs(m.start - a.start) ? d : m));
  return { start: best.start, end: best.end, method: 'diagram' };
}

/** CSV round-trips may turn "\n" into "\r\n". */
export const normaliseQuote = (q: string) => q.replace(/\r\n?/g, '\n');

function commonSuffix(a: string, b: string): number {
  let k = 0;
  while (k < a.length && k < b.length && a[a.length - 1 - k] === b[b.length - 1 - k]) k++;
  return k;
}
function commonPrefix(a: string, b: string): number {
  let k = 0;
  while (k < a.length && k < b.length && a[k] === b[k]) k++;
  return k;
}

/**
 * Re-attach an anchor to `text`:
 *  1. stored offsets still select exactly the quote -> keep;
 *  2. otherwise find the quote; if unique use it;
 *  3. if several, score each by how well the stored prefix/suffix match the surrounding text;
 *  4. ties (including no context match) go to the occurrence nearest the old offset;
 *  5. no occurrence -> null (orphaned).
 */
export function reanchor(text: string, a: AnchorLike): ReanchorResult {
  const q = normaliseQuote(a.quote);
  if (!q) return null;
  if (a.start >= 0 && a.end <= text.length && a.end - a.start === q.length && text.slice(a.start, a.end) === q) {
    return { start: a.start, end: a.end, method: 'offset' };
  }
  const hits: number[] = [];
  for (let i = text.indexOf(q); i !== -1; i = text.indexOf(q, i + 1)) hits.push(i);
  if (hits.length === 0) return null;
  if (hits.length === 1) return { start: hits[0] as number, end: (hits[0] as number) + q.length, method: 'quote' };

  const prefix = normaliseQuote(a.prefix);
  const suffix = normaliseQuote(a.suffix);
  let best = hits[0] as number;
  let bestScore = -1;
  let bestDist = Infinity;
  for (const h of hits) {
    const score =
      commonSuffix(text.slice(Math.max(0, h - prefix.length), h), prefix) + commonPrefix(text.slice(h + q.length, h + q.length + suffix.length), suffix);
    const dist = Math.abs(h - a.start);
    if (score > bestScore || (score === bestScore && dist < bestDist)) {
      best = h;
      bestScore = score;
      bestDist = dist;
    }
  }
  return { start: best, end: best + q.length, method: bestScore > 0 ? 'context' : 'nearest' };
}
