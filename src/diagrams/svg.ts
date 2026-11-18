import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

/**
 * Sanitise generated SVG before it is inlined into the page.
 *
 * Allowed: SVG shapes/text/gradients/filters, <style> with local-only CSS (D2 scopes its rules to a per-diagram
 * class), internal fragment references (#id) and data:image URLs. Removed: scripts, foreignObject, event handlers,
 * links (the element is dropped, its content kept), and every external URL in href/xlink:href/style/CSS, so a
 * diagram can never cause a network request or run code.
 */

type Purify = ReturnType<typeof createDOMPurify>;
let purify: Purify | undefined;

const SAFE_HREF = /^(#|data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,)/i;

/** True if CSS contains nothing that could load a resource or run code. */
export function cssIsSafe(css: string): boolean {
  if (/@import|expression\s*\(|javascript:|behavior\s*:|-moz-binding/i.test(css)) return false;
  for (const m of css.matchAll(/url\(\s*(["']?)([^)"']*)\1\s*\)/gi)) {
    if (!/^(#|data:)/i.test((m[2] ?? '').trim())) return false;
  }
  return true;
}

function getPurify(): Purify {
  if (purify) return purify;
  const p = createDOMPurify(new JSDOM('').window as unknown as Window & typeof globalThis);
  p.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName === 'style' && !cssIsSafe(node.textContent ?? '')) node.parentNode?.removeChild(node);
  });
  p.addHook('uponSanitizeAttribute', (_node, data) => {
    const name = data.attrName.toLowerCase();
    if (name === 'href' || name === 'xlink:href' || name === 'src') {
      if (!SAFE_HREF.test(data.attrValue.trim())) data.keepAttr = false;
    } else if (name === 'style' && !cssIsSafe(data.attrValue)) {
      data.keepAttr = false;
    }
  });
  purify = p;
  return p;
}

export function sanitizeSvg(svg: string): string {
  const input = svg.replace(/^\s*<\?xml[^>]*\?>/i, '');
  return getPurify().sanitize(input, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ['style'],
    FORBID_TAGS: ['a', 'script', 'foreignObject', 'iframe', 'object', 'embed', 'animate', 'set', 'animateTransform', 'animateMotion'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: true,
  }) as string;
}
