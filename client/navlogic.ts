export type Action = 'page-up' | 'page-down' | 'home' | 'end' | 'prev-section' | 'next-section';

export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  defaultPrevented?: boolean;
}

/** True when keyboard input is going to a control where shortcuts must not fire. */
export function isTypingTarget(el: Element | EventTarget | null): boolean {
  if (!el || !(el as Element).tagName) return false;
  const e = el as HTMLElement;
  const tag = e.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (e.isContentEditable) return true;
  const role = e.getAttribute?.('role');
  return role === 'textbox' || role === 'combobox' || role === 'searchbox';
}

/** Map a key event to a navigation action, or null when it is not ours. */
export function actionFor(e: KeyLike, target: EventTarget | null): Action | null {
  if (e.defaultPrevented || isTypingTarget(target)) return null;
  if (e.metaKey || e.shiftKey) return null;
  const mod = e.ctrlKey || e.altKey;
  if (!mod) {
    switch (e.key) {
      case 'PageUp': return 'page-up';
      case 'PageDown': return 'page-down';
      case 'Home': return 'home';
      case 'End': return 'end';
    }
    return null;
  }
  if (e.ctrlKey && e.altKey) return null;
  if (e.key === 'ArrowUp') return 'prev-section';
  if (e.key === 'ArrowDown') return 'next-section';
  return null;
}

export const TOLERANCE = 4;

export interface LastNav {
  index: number;
  /** true if the user has not scrolled since this navigation */
  stable: boolean;
}

/**
 * Choose the heading to jump to. `tops` are heading top positions relative to the
 * viewport; `offset` is the bottom of the sticky header. Returns an index, -1 (before
 * the first heading) or tops.length (after the last).
 * If the previous jump could not align its heading (end of document), `last.stable`
 * lets us step on by index so navigation never gets stuck.
 */
export function pickHeading(tops: number[], offset: number, dir: 1 | -1, last?: LastNav): number {
  let idx: number;
  if (dir === 1) {
    idx = tops.findIndex((t) => t > offset + TOLERANCE);
    if (idx === -1) idx = tops.length;
    if (last?.stable && idx <= last.index) idx = last.index + 1;
  } else {
    idx = -1;
    for (let i = 0; i < tops.length; i++) if ((tops[i] as number) < offset - TOLERANCE) idx = i;
    if (last?.stable && idx >= last.index) idx = last.index - 1;
  }
  return Math.max(-1, Math.min(tops.length, idx));
}

export interface Crumb {
  level: number;
  text: string;
}

/** Breadcrumb path for the heading at `currentIndex` (ancestors by level). */
export function breadcrumbFor(headings: Crumb[], currentIndex: number): Crumb[] {
  if (currentIndex < 0) return [];
  const stack: Crumb[] = [];
  for (let i = 0; i <= currentIndex; i++) {
    const h = headings[i] as Crumb;
    while (stack.length && (stack[stack.length - 1] as Crumb).level >= h.level) stack.pop();
    stack.push(h);
  }
  return stack;
}

export const ZOOM_MIN = 100;
export const ZOOM_MAX = 200;
export const ZOOM_STEP = 10;

export function clampZoom(v: number): number {
  if (!Number.isFinite(v)) return ZOOM_MIN;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(v / ZOOM_STEP) * ZOOM_STEP));
}
