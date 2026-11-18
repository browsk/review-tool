import { createHighlighter, type Highlighter } from 'shiki';
import { visit } from 'unist-util-visit';
import type { Root, Element, ElementContent } from 'hast';
import type { Diagnostic } from './diagnostics.js';

const LANGS = ['ts', 'js', 'json', 'bash', 'sh', 'yaml', 'sql', 'java', 'python', 'csharp', 'html', 'css', 'xml', 'markdown', 'diff', 'powershell'];
let highlighterP: Promise<Highlighter> | undefined;

function getHighlighter(): Promise<Highlighter> {
  highlighterP ??= createHighlighter({ themes: ['github-light', 'github-dark'], langs: LANGS });
  return highlighterP;
}

const DIAGRAM_LANGS = new Set(['mermaid', 'd2']);

/** Syntax-highlight fenced code with Shiki (bundled, local). Failures degrade to plain <pre>. */
export function highlightPlugin(diags: Diagnostic[]) {
  return () => async (tree: Root) => {
    const targets: { pre: Element; code: Element; lang: string }[] = [];
    visit(tree, 'element', (el: Element) => {
      if (el.tagName !== 'pre') return;
      const code = el.children.find((c): c is Element => c.type === 'element' && c.tagName === 'code');
      if (!code) return;
      const cls = (code.properties?.className as string[] | undefined) ?? [];
      const lang = cls.find((c) => c.startsWith('language-'))?.slice(9);
      if (lang && !DIAGRAM_LANGS.has(lang)) targets.push({ pre: el, code, lang });
    });
    if (!targets.length) return;
    let hl: Highlighter;
    try {
      hl = await getHighlighter();
    } catch (err) {
      diags.push({ severity: 'warning', code: 'highlighter', message: `Syntax highlighter unavailable (${(err as Error).message})` });
      return;
    }
    for (const { pre, code, lang } of targets) {
      try {
        if (!hl.getLoadedLanguages().includes(lang)) continue;
        const text = code.children.map((c) => (c.type === 'text' ? c.value : '')).join('');
        const hast = hl.codeToHast(text, { lang, themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: false });
        const newPre = (hast.children[0] as Element | undefined);
        if (newPre?.tagName === 'pre') {
          pre.properties = { ...pre.properties, ...newPre.properties };
          const newCode = newPre.children[0] as Element;
          code.children = newCode.children as ElementContent[];
          code.properties = { ...code.properties, className: ['shiki-code', `language-${lang}`] };
        }
      } catch {
        /* plain <pre> remains */
      }
    }
  };
}
