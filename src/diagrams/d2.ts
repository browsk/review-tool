import { createHash } from 'node:crypto';
import { D2 } from '@terrastruct/d2';
import type { DiagramIssue, DiagramRenderer, DiagramResult, DiagramSettings, Theme } from './types.js';
import { DEFAULT_DIAGRAM_SETTINGS } from './types.js';
import { sanitizeSvg } from './svg.js';

/** Pinned: @terrastruct/d2 is pre-1.0. Checked against package.json by a unit test. */
export const D2_VERSION = '0.1.33';

type Layout = 'dagre' | 'elk';

/** The parts of D2.js that we use (its published types omit the layout option and eady, both present at runtime). */
interface D2Like {
  ready: Promise<unknown>;
  worker?: { terminate(): unknown };
  compile(source: string, options: { layout: Layout }): Promise<{ diagram: unknown; renderOptions: Record<string, unknown> }>;
  render(diagram: unknown, options: Record<string, unknown>): Promise<string>;
}

export interface LayoutChoice {
  layout: Layout;
  warnings: DiagramIssue[];
}

/**
 * Decide the layout engine from `layout-engine:` in the diagram's `vars.d2-config` block.
 * TALA is proprietary and not part of D2.js: fall back to the default engine and warn.
 */
export function chooseLayout(source: string, dflt: Layout): LayoutChoice {
  const warnings: DiagramIssue[] = [];
  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*layout-engine\s*:\s*["']?([A-Za-z0-9_-]+)["']?\s*;?\s*$/.exec(lines[i] as string);
    if (!m) continue;
    const engine = (m[1] as string).toLowerCase();
    if (engine === 'dagre' || engine === 'elk') return { layout: engine, warnings };
    warnings.push({
      line: i + 1,
      message:
        engine === 'tala'
          ? `D2 layout engine "tala" is proprietary and not available here; using "${dflt}" instead.`
          : `Unknown D2 layout engine "${m[1]}"; using "${dflt}" instead.`,
    });
    return { layout: dflt, warnings };
  }
  return { layout: dflt, warnings };
}

/** Turn a D2 compile error (a JSON array of {range, errmsg}) into one readable issue with a line number. */
export function parseD2Error(err: unknown): DiagramIssue {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const list = JSON.parse(raw) as { range?: string; errmsg?: string }[];
    if (Array.isArray(list) && list.length) {
      const first = list[0] as { range?: string; errmsg?: string };
      const m = /^[^:]*:(\d+):(\d+):\s*(.*)$/s.exec(first.errmsg ?? '');
      const more = list.length > 1 ? ` (and ${list.length - 1} more error${list.length === 2 ? '' : 's'})` : '';
      if (m) return { line: Number(m[1]), message: `${m[3]}${more}` };
      const r = /(\d+):\d+:\d+-/.exec(first.range ?? '');
      return { line: r ? Number(r[1]) + 1 : undefined, message: `${first.errmsg ?? 'syntax error'}${more}` };
    }
  } catch {
    /* not JSON */
  }
  return { message: raw.slice(0, 300) };
}

interface CacheEntry {
  result: DiagramResult;
  /** failures expire so that a fixed environment (or a transient timeout) is retried */
  expires: number | null;
}

/**
 * Renders D2 diagrams to SVG in-process with D2.js (WASM, running on its own worker thread).
 * - one render at a time (D2.js keeps a single in-flight request per instance);
 * - the timeout starts after WASM warm-up, and a hung render is killed by terminating the worker;
 * - results are cached by sha256(source + theme + layout + D2 version + theme ids), failures only briefly.
 */
export class D2Service {
  private d2: D2Like | null = null;
  private chain: Promise<unknown> = Promise.resolve();
  private cache = new Map<string, CacheEntry>();
  renders = 0; // number of actual (non-cached) renders, for tests
  constructor(private maxEntries = 200, private failureTtlMs = 30_000) {}

  cacheKey(source: string, theme: Theme, layout: Layout, s: DiagramSettings): string {
    const themeId = theme === 'dark' ? s.d2ThemeDark : s.d2ThemeLight;
    return createHash('sha256').update([source, theme, layout, D2_VERSION, s.d2ThemeLight, s.d2ThemeDark, themeId].join('\u0000')).digest('hex');
  }

  render(source: string, theme: Theme, settings: DiagramSettings = DEFAULT_DIAGRAM_SETTINGS): Promise<DiagramResult> {
    if (Buffer.byteLength(source) > settings.maxSourceBytes) {
      return Promise.resolve({ error: { message: `The diagram source is too large (limit ${Math.round(settings.maxSourceBytes / 1000)} KB).` } });
    }
    const choice = chooseLayout(source, settings.d2Layout);
    const key = this.cacheKey(source, theme, choice.layout, settings);
    const hit = this.cache.get(key);
    if (hit && (hit.expires === null || hit.expires > Date.now())) {
      this.cache.delete(key);
      this.cache.set(key, hit); // LRU touch
      return Promise.resolve(withWarnings(hit.result, choice.warnings));
    }
    const run = () => this.renderNow(source, theme, choice.layout, settings, key);
    const p = this.chain.then(run, run) as Promise<DiagramResult>;
    this.chain = p.catch(() => undefined);
    return p.then((r) => withWarnings(r, choice.warnings));
  }

  private async renderNow(source: string, theme: Theme, layout: Layout, s: DiagramSettings, key: string): Promise<DiagramResult> {
    let result: DiagramResult;
    try {
      const d2 = await this.ensure();
      this.renders++;
      result = await withTimeout(this.compileAndRender(d2, source, theme, layout, s), s.timeoutMs, () => this.kill());
    } catch (e) {
      result = e instanceof TimeoutError ? { error: { message: `The diagram took longer than ${s.timeoutMs / 1000} s to render and was stopped.` } } : { error: parseD2Error(e) };
    }
    this.store(key, result);
    return result;
  }

  private async compileAndRender(d2: D2Like, source: string, theme: Theme, layout: Layout, s: DiagramSettings): Promise<DiagramResult> {
    const compiled = await d2.compile(source, { layout });
    const themeID = theme === 'dark' ? s.d2ThemeDark : s.d2ThemeLight;
    // the salt makes class names and ids unique per variant, so the light and dark SVGs cannot style each other
    const svg = await d2.render(compiled.diagram, { ...compiled.renderOptions, themeID, salt: theme });
    return { svg: sanitizeSvg(svg) };
  }

  private async ensure(): Promise<D2Like> {
    if (!this.d2) {
      const d2 = new D2() as unknown as D2Like;
      this.d2 = d2;
      // WASM warm-up gets its own generous limit so that the per-diagram timeout measures rendering only
      await withTimeout(d2.ready, 60_000, () => this.kill());
    }
    return this.d2 as D2Like;
  }

  private kill(): void {
    const d2 = this.d2;
    this.d2 = null;
    try {
      void d2?.worker?.terminate();
    } catch {
      /* already gone */
    }
  }

  private store(key: string, result: DiagramResult): void {
    this.cache.set(key, { result, expires: result.error ? Date.now() + this.failureTtlMs : null });
    while (this.cache.size > this.maxEntries) this.cache.delete(this.cache.keys().next().value as string);
  }

  /** Stop the worker thread (tests, shutdown). */
  dispose(): void {
    this.kill();
  }
}

class TimeoutError extends Error {}

function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      onTimeout();
      reject(new TimeoutError('timeout'));
    }, ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function withWarnings(r: DiagramResult, extra: DiagramIssue[]): DiagramResult {
  return extra.length ? { ...r, warnings: [...(r.warnings ?? []), ...extra] } : r;
}

export const d2Service = new D2Service();

export function d2Renderer(settings: DiagramSettings = DEFAULT_DIAGRAM_SETTINGS, service: D2Service = d2Service): DiagramRenderer {
  return {
    lang: 'd2',
    title: 'D2',
    kind: 'server',
    render: (source, theme) => service.render(source, theme, settings),
  };
}
