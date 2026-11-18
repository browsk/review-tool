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
  bg: '#f1f4f2',
  fg: '#15222b',
  layers: {
    reject: { tint: [179, 32, 58], alpha: 0.14, line: '#b3203a' },
    cond: { tint: [240, 180, 0], alpha: 0.28, line: '#8a5f00' },
    accept: { tint: [11, 107, 87], alpha: 0.14, line: '#0b6b57' },
  },
};

export const DARK: ThemePalette = {
  bg: '#0f1b26',
  fg: '#dde7ec',
  layers: {
    reject: { tint: [200, 50, 75], alpha: 0.24, line: '#ff7a8a' },
    cond: { tint: [178, 106, 0], alpha: 0.22, line: '#f2c14e' },
    accept: { tint: [20, 140, 110], alpha: 0.24, line: '#5fd1b0' },
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
