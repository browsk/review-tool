import type { Element, ElementContent, Root } from 'hast';
import { visit } from 'unist-util-visit';
import type { Diagnostic } from './diagnostics.js';
import { escapeHtml } from './escape.js';
import type { DiagramRenderer, DiagramResult } from '../diagrams/types.js';

/**
 * Diagram blocks (```mermaid / ```d2 fences).
 *
 * During the rehype pass each fence is replaced by a plain <div> holding a random marker (unforgeable: the
 * nonce is generated per render). After sanitising, the marker is replaced by the finished <figure>, whose
 * SVG was sanitised separately. User-authored HTML can therefore never produce diagram markup, and the
 * "sanitise last" rule of the pipeline still holds for everything the author wrote.
 */

export interface DiagramSlot {
  marker: string;
  lang: string;
  title: string;
  kind: 'server' | 'client';
  source: string;
  /** 1-based line of the opening fence in the document */
  fenceLine: number;
  light: DiagramResult;
  dark: DiagramResult;
}

function textOf(n: ElementContent): string {
  if (n.type === 'text') return n.value;
  if (n.type === 'element') return n.children.map(textOf).join('');
  return '';
}

export function lineAt(source: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i++) if (source.charCodeAt(i) === 10) line++;
  return line;
}

export function diagramsPlugin(ctx: { source: string; renderers: Map<string, DiagramRenderer>; nonce: string; slots: DiagramSlot[]; diags: Diagnostic[] }) {
  return () => async (tree: Root) => {
    const found: { parent: Element | Root; index: number; lang: string; source: string; start?: number; end?: number }[] = [];
    visit(tree, 'element', (el: Element, index, parent) => {
      if (el.tagName !== 'pre' || !parent || typeof index !== 'number') return;
      const code = el.children.find((c): c is Element => c.type === 'element' && c.tagName === 'code');
      const cls = (code?.properties?.className as string[] | undefined) ?? [];
      const lang = cls.find((c) => c.startsWith('language-'))?.slice(9).toLowerCase();
      if (!code || !lang || !ctx.renderers.has(lang)) return;
      found.push({
        parent: parent as Element | Root,
        index,
        lang,
        source: code.children.map(textOf).join('').replace(/\n$/, ''),
        // remark-rehype puts the source offsets on <pre> or on its <code>, depending on version
        start: (el.properties?.dataSrcStart ?? code.properties?.dataSrcStart) as number | undefined,
        end: (el.properties?.dataSrcEnd ?? code.properties?.dataSrcEnd) as number | undefined,
      });
    });

    for (const f of found) {
      const renderer = ctx.renderers.get(f.lang) as DiagramRenderer;
      const fenceLine = f.start !== undefined ? lineAt(ctx.source, f.start) : 1;
      const marker = `rt-diagram-${ctx.nonce}-${ctx.slots.length}`;
      let light: DiagramResult = {};
      let dark: DiagramResult = {};
      if (renderer.kind === 'server') {
        light = await renderer.render(f.source, 'light').catch((e: Error) => ({ error: { message: e.message } }));
        dark = light.error ? light : await renderer.render(f.source, 'dark').catch((e: Error) => ({ error: { message: e.message } }));
      }
      ctx.slots.push({ marker, lang: f.lang, title: renderer.title, kind: renderer.kind, source: f.source, fenceLine, light, dark });

      const at = { srcStart: f.start };
      if (light.error) {
        ctx.diags.push({
          severity: 'warning',
          code: 'diagram-failed',
          message: `${renderer.title} diagram failed to render: ${light.error.message}`,
          line: fenceLine + (light.error.line ?? 0),
          ...at,
        });
      }
      for (const w of light.warnings ?? []) {
        ctx.diags.push({ severity: 'warning', code: 'diagram-warning', message: `${renderer.title} diagram: ${w.message}`, line: fenceLine + (w.line ?? 0), ...at });
      }

      const div: Element = {
        type: 'element',
        tagName: 'div',
        properties: { ...(f.start !== undefined ? { dataSrcStart: f.start } : {}), ...(f.end !== undefined ? { dataSrcEnd: f.end } : {}) },
        children: [{ type: 'text', value: marker }],
      };
      (f.parent.children as ElementContent[])[f.index] = div;
    }
  };
}

/** Replace each marker with its figure. `attrs` (section id, source offsets) come from the sanitised output. */
export async function finalizeDiagrams(html: string, slots: DiagramSlot[], highlight: (source: string, lang: string) => Promise<string>): Promise<string> {
  let out = html;
  for (const s of slots) {
    const re = new RegExp(`<div((?:\\s[^>]*)?)>${s.marker}</div>`);
    const sourceHtml = await highlight(s.source, s.lang);
    out = out.replace(re, (_m, attrs: string) => figureHtml(s, attrs, sourceHtml));
  }
  return out;
}

function figureHtml(s: DiagramSlot, attrs: string, sourceHtml: string): string {
  const err = s.light.error;
  const cls = `diagram diagram-${s.lang}${err ? ' failed' : ''}`;
  const body =
    s.kind === 'server'
      ? err
        ? ''
        : `<div class="diagram-svg light">${s.light.svg ?? ''}</div><div class="diagram-svg dark">${s.dark.svg ?? ''}</div>`
      : '<div class="diagram-client"></div>';
  const notice = err ? `Diagram failed to render: ${escapeHtml(err.message)}` : '';
  return (
    `<figure class="${cls}" data-diagram-lang="${s.lang}" data-fence-line="${s.fenceLine}" data-diagram-source="${escapeHtml(s.source)}"` +
    `${err ? ' data-diagram-status="failed"' : ''}${attrs}>` +
    `<div class="diagram-body">${body}</div>` +
    `<p class="diagram-notice" role="status">${notice}</p>` +
    `<div class="diagram-source">${sourceHtml}</div>` +
    `</figure>`
  );
}
