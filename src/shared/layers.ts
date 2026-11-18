export const MAX_LAYERS = 5;

export interface Span {
  id: string;
  start: number;
  end: number;
}

/**
 * Assign each span a layer 0..max-1 so that spans in the same layer never overlap
 * (interval colouring). Browsers paint each Highlight object once, so overlapping ranges must live in
 * different Highlight objects for their translucent tints to stack. If more than `max` ranges overlap
 * at a point, the extras share the last layer (the tint stops deepening; contrast stays AA).
 */
export function assignLayers(spans: Span[], max = MAX_LAYERS): Map<string, number> {
  const out = new Map<string, number>();
  const layerEnd: number[] = [];
  const sorted = [...spans].sort((a, b) => a.start - b.start || b.end - a.end);
  for (const s of sorted) {
    let k = layerEnd.findIndex((end) => end <= s.start);
    if (k === -1) k = layerEnd.length < max ? layerEnd.length : max - 1;
    layerEnd[k] = Math.max(layerEnd[k] ?? 0, s.end);
    out.set(s.id, k);
  }
  return out;
}
