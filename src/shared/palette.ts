/** Highlight colours. styles.css must use the same values (checked by test/unit/palette.test.ts). */
export type StatusKey = 'reject' | 'cond' | 'accept';
export interface Layer {
  /** tint colour, composited with alpha so overlaps deepen */
  tint: [number, number, number];
  alpha: number;
  /** underline colour (solid) */
  line: string;
}
export interface ThemePalette {
  bg: string;
  fg: string;
  layers: Record<StatusKey, Layer>;
}

export const LIGHT: ThemePalette = {
  bg: '#ffffff',
  fg: '#1a1a1a',
  layers: {
    reject: { tint: [211, 47, 47], alpha: 0.16, line: '#c62828' },
    cond: { tint: [245, 124, 0], alpha: 0.18, line: '#b26a00' },
    accept: { tint: [46, 125, 50], alpha: 0.16, line: '#2e7d32' },
  },
};

export const DARK: ThemePalette = {
  bg: '#14161a',
  fg: '#e6e8eb',
  layers: {
    reject: { tint: [198, 40, 40], alpha: 0.22, line: '#ef5350' },
    cond: { tint: [178, 106, 0], alpha: 0.22, line: '#ffb74d' },
    accept: { tint: [46, 125, 50], alpha: 0.22, line: '#66bb6a' },
  },
};

export const hex = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];

/** Composite `n` translucent layers of one tint over `bg`. */
export function stack(bg: [number, number, number], layer: Layer, n: number): [number, number, number] {
  let c = bg;
  for (let i = 0; i < n; i++) c = c.map((v, k) => v * (1 - layer.alpha) + (layer.tint[k] as number) * layer.alpha) as [number, number, number];
  return c;
}

const lin = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
export const luminance = ([r, g, b]: [number, number, number]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
