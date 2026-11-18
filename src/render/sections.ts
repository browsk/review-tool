import type { Root, Element, ElementContent } from 'hast';

export interface Section {
  /** 0 is the synthetic preamble (content before the first section heading) */
  id: number;
  /** heading depth that opened the section; 0 for the preamble */
  level: number;
  heading: string;
  /** source offset of the opening heading, when known */
  srcStart?: number;
}

export function textOf(node: Element | ElementContent): string {
  if (node.type === 'text') return node.value;
  if (node.type === 'element') return node.children.map(textOf).join('');
  return '';
}

const HEADING = /^h([1-6])$/;

/**
 * Section model. A section opens at a heading of depth === `level` (default 2) and runs to the
 * next heading of depth <= level. Subsections (deeper headings) belong to the parent section.
 * Shallower headings (e.g. the H1 title) before the first section form the preamble (id 0);
 * shallower headings after the first section close it and open a new section of their own.
 * Every top-level block is stamped with data-section-id so the client can resolve sections.
 */
export function sectionsPlugin(level: number, out: Section[]) {
  return () => (tree: Root) => {
    let cur = -1;
    let next = 1;
    let seenSection = false;
    for (const child of tree.children) {
      if (child.type !== 'element') continue;
      const m = HEADING.exec(child.tagName);
      const depth = m ? Number(m[1]) : 0;
      if (depth && (depth === level || (depth < level && seenSection))) {
        cur = next++;
        seenSection = true;
        out.push({
          id: cur,
          level: depth,
          heading: textOf(child).trim(),
          srcStart: child.properties?.dataSrcStart as number | undefined,
        });
      } else if (cur === -1) {
        cur = 0;
        out.push({ id: 0, level: 0, heading: '' });
      }
      child.properties = { ...child.properties, dataSectionId: String(cur) };
    }
  };
}
