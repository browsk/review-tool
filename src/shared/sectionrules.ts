import type { TextModel } from './textmodel.js';

export interface SectionInfo {
  id: string;
  heading: string;
  /** half-open interval over the normalised text; separators belong to the preceding section */
  start: number;
  end: number;
}

const HEADING = /^H[1-6]$/;

export function displayName(s: SectionInfo): string {
  return s.heading || (s.id === '0' ? 'the document introduction' : `section ${s.id}`);
}

/** Sections derived from data-section-id stamping (see src/render/sections.ts). */
export function sectionsOf(model: TextModel): SectionInfo[] {
  const out: SectionInfo[] = [];
  for (const e of model.entries) {
    if (e.sectionId === null) continue;
    const last = out[out.length - 1];
    if (last && last.id === e.sectionId) continue;
    const first = model.root.querySelector(`[data-section-id="${CSS_ESCAPE(e.sectionId)}"]`);
    out.push({
      id: e.sectionId,
      heading: first && HEADING.test(first.tagName) ? (first.textContent ?? '').trim() : '',
      start: e.start,
      end: model.text.length,
    });
    if (last) last.end = e.start;
  }
  return out;
}

const CSS_ESCAPE = (s: string) => s.replace(/[^\w-]/g, '\\$&');

export function sectionAt(sections: SectionInfo[], offset: number): SectionInfo | undefined {
  let lo = 0;
  let hi = sections.length - 1;
  let found: SectionInfo | undefined;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const s = sections[mid] as SectionInfo;
    if (s.start <= offset) {
      found = s;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

export type SelectionCheck =
  | { ok: true; section: SectionInfo }
  | { ok: false; reason: 'spans-sections'; from: SectionInfo; to: SectionInfo }
  | { ok: false; reason: 'empty' };

/** A selection may sit inside at most one section: first and last character must share a section. */
export function validateSelection(sections: SectionInfo[], start: number, end: number): SelectionCheck {
  if (end <= start || sections.length === 0) return { ok: false, reason: 'empty' };
  const a = sectionAt(sections, start);
  const b = sectionAt(sections, end - 1);
  if (!a || !b) return { ok: false, reason: 'empty' };
  if (a.id !== b.id) return { ok: false, reason: 'spans-sections', from: a, to: b };
  return { ok: true, section: a };
}
