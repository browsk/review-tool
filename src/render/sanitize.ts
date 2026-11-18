import { defaultSchema } from 'rehype-sanitize';
import type { Options } from 'rehype-sanitize';

// only Shiki's CSS-variable colours and font styling; no urls, no arbitrary properties
const SHIKI_STYLE = /^(?:\s*(?:--shiki-(?:light|dark)(?:-bg)?:\s*#[0-9a-fA-F]{3,8}|font-style:\s*italic|font-weight:\s*bold|text-decoration:\s*underline)\s*;?)*$/;

/**
 * Explicit sanitise schema. Allows only what the pipeline generates:
 * data-src-*, data-section-id, shiki classes/styles on code spans, data-diagram-*.
 * http/https/mailto and relative URLs only. ids are prefixed to prevent clobbering.
 */
export const schema: Options = {
  ...defaultSchema,
  clobberPrefix: 'user-content-',
  protocols: {
    ...defaultSchema.protocols,
    href: ['http', 'https', 'mailto'],
    src: [],
  },
  tagNames: [...(defaultSchema.tagNames ?? []), 'section'],
  attributes: {
    ...defaultSchema.attributes,
    '*': [
      ...(defaultSchema.attributes?.['*'] ?? []),
      'dataSrcStart',
      'dataSrcEnd',
      'dataSectionId',
      'dataNoAnchor',
    ],
    code: [...(defaultSchema.attributes?.code ?? []), ['className', /^(language-|shiki|hljs)[\w-]*$/]],
    pre: [
      ...(defaultSchema.attributes?.pre ?? []),
      ['className', /^(fallback|mermaid|shiki)[\w -]*$/],
      ['style', SHIKI_STYLE],
      'tabIndex',
    ],
    span: [...(defaultSchema.attributes?.span ?? []), ['className', /^[\w -]+$/], ['style', SHIKI_STYLE]],
    img: ['src', 'alt', 'title', 'width', 'height', 'dataMissing'],
  },
  // never allow hx-* (htmx) attributes, event handlers, or style attributes from document HTML
  strip: ['script', 'style'],
};
