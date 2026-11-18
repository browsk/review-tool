import { actionFor, breadcrumbFor, pickHeading, type Action, type LastNav } from './navlogic.js';

const PAGE_OVERLAP = 48;

function headerHeight(): number {
  return document.querySelector<HTMLElement>('.app-header')?.offsetHeight ?? 0;
}

function navHeadings(): HTMLElement[] {
  const doc = document.getElementById('doc');
  if (!doc) return [];
  const max = Number(doc.dataset.navMaxLevel ?? 6);
  const sel = Array.from({ length: max }, (_, i) => `h${i + 1}`).join(',');
  return Array.from(doc.querySelectorAll<HTMLElement>(sel)).filter((h) => !h.classList.contains('sr-only'));
}

const levelOf = (h: HTMLElement) => Number(h.tagName.slice(1));

export function initNavigation(): void {
  const doc = document.getElementById('doc');
  if (!doc) return;

  const root = document.documentElement;
  const syncHeaderVar = () => root.style.setProperty('--header-h', `${headerHeight()}px`);
  syncHeaderVar();
  new ResizeObserver(syncHeaderVar).observe(document.querySelector('.app-header')!);

  let last: LastNav | undefined;
  let lastY = -1;

  const scrollToY = (y: number) => window.scrollTo({ top: y, behavior: 'instant' });

  function jump(dir: 1 | -1): void {
    const hs = navHeadings();
    if (!hs.length) return;
    const offset = headerHeight();
    const tops = hs.map((h) => h.getBoundingClientRect().top);
    const stable = !!last && window.scrollY === lastY;
    const idx = pickHeading(tops, offset, dir, last && { index: last.index, stable });
    if (idx < 0) {
      scrollToY(0);
      last = undefined;
    } else if (idx >= hs.length) {
      scrollToY(document.documentElement.scrollHeight);
      last = undefined;
    } else {
      hs[idx]!.scrollIntoView({ block: 'start', behavior: 'instant' });
      last = { index: idx, stable: true };
    }
    lastY = window.scrollY;
    updateBreadcrumb();
  }

  function run(a: Action): void {
    const page = Math.max(50, window.innerHeight - headerHeight() - PAGE_OVERLAP);
    switch (a) {
      case 'page-down': window.scrollBy({ top: page, behavior: 'instant' }); break;
      case 'page-up': window.scrollBy({ top: -page, behavior: 'instant' }); break;
      case 'home': scrollToY(0); break;
      case 'end': scrollToY(document.documentElement.scrollHeight); break;
      case 'next-section': jump(1); return;
      case 'prev-section': jump(-1); return;
    }
    last = undefined;
  }

  document.addEventListener('keydown', (e) => {
    if (document.querySelector('dialog[open]')) return; // modal dialogs own the keyboard
    const a = actionFor(e, e.target);
    if (!a) return;
    e.preventDefault();
    run(a);
  });

  document.getElementById('next-section')?.addEventListener('click', () => jump(1));
  document.getElementById('prev-section')?.addEventListener('click', () => jump(-1));

  // Sticky breadcrumb showing where the discussion is
  const crumb = document.getElementById('breadcrumb');
  let raf = 0;
  function updateBreadcrumb(): void {
    if (!crumb) return;
    const hs = navHeadings();
    const offset = headerHeight() + 4;
    let cur = -1;
    hs.forEach((h, i) => {
      if (h.getBoundingClientRect().top <= offset) cur = i;
    });
    // at the end of the page the last headings cannot scroll to the top: the one we jumped to is current
    if (last && window.scrollY === lastY && last.index > cur) cur = last.index;
    const path = breadcrumbFor(
      hs.map((h) => ({ level: levelOf(h), text: (h.textContent ?? '').trim() })),
      cur,
    );
    crumb.replaceChildren(
      ...path.flatMap((c, i) => {
        const span = document.createElement('span');
        span.className = 'crumb';
        span.textContent = c.text;
        if (i === path.length - 1) span.setAttribute('aria-current', 'true');
        if (i === 0) return [span];
        const sep = document.createElement('span');
        sep.className = 'crumb-sep';
        sep.setAttribute('aria-hidden', 'true');
        sep.textContent = '›';
        return [sep, span];
      }),
    );
    crumb.dataset.current = path.length ? path[path.length - 1]!.text : '';
  }
  window.addEventListener(
    'scroll',
    () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(updateBreadcrumb);
    },
    { passive: true },
  );
  window.addEventListener('resize', updateBreadcrumb);
  updateBreadcrumb();
}
