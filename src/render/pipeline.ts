import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import { toString } from 'mdast-util-to-string';
import type { Root, Content, Heading, Code, Image } from 'mdast';
import type { Diagnostic } from './diagnostics.js';
import { schema } from './sanitize.js';
import { highlightPlugin } from './highlight.js';

export interface RenderOptions {
  /** returns true if a relative asset exists (resolved against the document directory) */
  assetExists?: (relPath: string) => boolean;
  /** URL prefix the asset route is mounted on */
  assetPrefix?: string;
}

export interface RenderResult {
  html: string;
  diagnostics: Diagnostic[];
  frontmatter?: string;
  /** true if the whole parse failed and raw text was returned */
  failed: boolean;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-');
}

const isRelative = (u: string) => !/^([a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(u);

function lineOf(node: { position?: { start: { line: number } } }): number | undefined {
  return node.position?.start.line;
}

/** Run fn; on failure replace the node with its raw source in a fallback <pre>. */
function tryNode(node: Content, source: string, diags: Diagnostic[], fn: () => void): void {
  try {
    fn();
  } catch (err) {
    const raw = node.position ? source.slice(node.position.start.offset, node.position.end.offset) : '';
    const n = node as unknown as Record<string, unknown>;
    for (const k of Object.keys(n)) if (k !== 'position') delete n[k];
    Object.assign(n, {
      type: 'code',
      lang: null,
      value: raw,
      data: { hName: 'pre', hProperties: { className: ['fallback'] }, hChildren: [{ type: 'text', value: raw }] },
    });
    diags.push({
      severity: 'error',
      code: 'node-render',
      message: `Failed to render a node; showing raw source (${(err as Error).message})`,
      line: node.position?.start.line,
    });
  }
}

function placeholder(img: Image, text: string): void {
  const m = img as unknown as { data: Record<string, unknown> };
  m.data.hName = 'span';
  m.data.hProperties = { className: ['missing-image'], dataSrcStart: img.position?.start.offset, dataSrcEnd: img.position?.end.offset };
  m.data.hChildren = [{ type: 'text', value: text }];
}

function analysePlugin(source: string, diags: Diagnostic[], opts: RenderOptions) {
  return () => (tree: Root) => {
    const slugs = new Set<string>();
    let prevLevel = 0;
    visit(tree, 'heading', (h: Heading) => {
      slugs.add(slugify(toString(h)));
    });

    visit(tree, (node, _i, _parent) => {
      const n = node as Content;
      if (n.type === 'yaml' || (n.type as string) === 'root') return;
      tryNode(n, source, diags, () => {
        if (n.position) {
          const data = ((n as { data?: Record<string, unknown> }).data ??= {});
          const props = (data.hProperties ??= {}) as Record<string, unknown>;
          if (n.type !== 'text' && n.type !== 'inlineCode') {
            props.dataSrcStart = n.position.start.offset;
            props.dataSrcEnd = n.position.end.offset;
          }
        }
        if (n.type === 'heading') {
          if (prevLevel && n.depth > prevLevel + 1) {
            diags.push({
              severity: 'warning',
              code: 'heading-skip',
              message: `Heading level skipped (h${prevLevel} to h${n.depth}): "${toString(n)}"`,
              line: lineOf(n),
              srcStart: n.position?.start.offset,
            });
          }
          prevLevel = n.depth;
          const props = ((n as { data?: { hProperties?: Record<string, unknown> } }).data!.hProperties ??= {});
          props.id = slugify(toString(n));
        }
        if (n.type === 'code') {
          const c = n as Code;
          const raw = c.position ? source.slice(c.position.start.offset, c.position.end.offset) : '';
          const fence = /^\s*(`{3,}|~{3,})/.exec(raw)?.[1];
          if (fence) {
            const lastLine = raw.trimEnd().split(/\r?\n/).pop() ?? '';
            const closed = raw.trimEnd().split(/\r?\n/).length > 1 && new RegExp(`^\\s*${fence[0]}{${fence.length},}\\s*$`).test(lastLine);
            if (!closed) {
              diags.push({
                severity: 'warning',
                code: 'unclosed-fence',
                message: 'Unclosed code fence was auto-closed at the end of the document',
                line: lineOf(c),
                srcStart: c.position?.start.offset,
              });
            }
          }
        }
        if (n.type === 'link') {
          const url = n.url;
          if (url.startsWith('#') && url.length > 1 && !slugs.has(decodeURIComponent(url.slice(1)))) {
            diags.push({
              severity: 'warning',
              code: 'unknown-link-target',
              message: `Link target "${url}" does not match any heading`,
              line: lineOf(n),
              srcStart: n.position?.start.offset,
            });
          }
        }
        if (n.type === 'image') {
          const img = n as Image;
          if (isRelative(img.url)) {
            const rel = decodeURI(img.url.split(/[?#]/)[0] ?? '');
            const exists = opts.assetExists ? opts.assetExists(rel) : true;
            if (exists) {
              img.url = `${opts.assetPrefix ?? '/assets/'}${rel.split('/').map(encodeURIComponent).join('/')}`;
            } else {
              diags.push({
                severity: 'warning',
                code: 'missing-image',
                message: `Image not found: ${img.url}`,
                line: lineOf(img),
                srcStart: img.position?.start.offset,
              });
              placeholder(img, `Missing image: ${img.url}`);
            }
          } else {
            diags.push({
              severity: 'warning',
              code: 'external-image',
              message: `External image not loaded (no network calls): ${img.url}`,
              line: lineOf(img),
              srcStart: img.position?.start.offset,
            });
            placeholder(img, `External image not loaded: ${img.url}`);
          }
        }
      });
    });
  };
}

function frontmatterOf(tree: Root, diags: Diagnostic[]): string | undefined {
  const fm = tree.children.find((c) => c.type === 'yaml') as { value: string } | undefined;
  if (!fm) return undefined;
  if (/^\s*[^#\s][^:\n]*$/m.test(fm.value) && !/:/.test(fm.value)) {
    diags.push({ severity: 'warning', code: 'frontmatter', message: 'Front matter does not look like valid key: value YAML' });
  }
  return fm.value;
}

export function looksBinary(buf: Buffer): boolean {
  if (buf.includes(0)) return true;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buf);
    return false;
  } catch {
    return true;
  }
}

export async function renderMarkdown(source: string, opts: RenderOptions = {}): Promise<RenderResult> {
  const diagnostics: Diagnostic[] = [];
  let frontmatter: string | undefined;
  try {
    const processor = unified()
      .use(remarkParse)
      .use(remarkFrontmatter, ['yaml'])
      .use(remarkGfm)
      .use(() => (tree: Root) => {
        frontmatter = frontmatterOf(tree, diagnostics);
      })
      .use(analysePlugin(source, diagnostics, opts))
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeRaw)
      .use(highlightPlugin(diagnostics))
      .use(rehypeSanitize, schema)
      .use(rehypeStringify);
    const file = await processor.process(source);
    return { html: String(file), diagnostics, frontmatter, failed: false };
  } catch (err) {
    diagnostics.push({
      severity: 'error',
      code: 'parse-failed',
      message: `Rendering failed; showing raw text (${(err as Error).message})`,
    });
    return { html: `<pre class="fallback">${escapeHtml(source)}</pre>`, diagnostics, failed: true };
  }
}
