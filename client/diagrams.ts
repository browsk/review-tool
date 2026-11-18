import { currentTheme } from './theme.js';
import { setClientDiagnostics, type ClientDiag } from './diagnostics.js';

const TIMEOUT_MS = 5000;

const LABELS = { source: 'Show source', hide: 'Hide source', expand: 'Expand', feedback: 'Add feedback on this diagram' };

function button(text: string, cls: string, title?: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.textContent = text;
  if (title) b.title = title;
  return b;
}

function visibleSvg(fig: HTMLElement): SVGElement | null {
  if (fig.dataset.diagramLang === 'mermaid') return fig.querySelector('.diagram-client svg');
  return fig.querySelector(`.diagram-svg.${currentTheme()} svg`);
}

function openExpanded(fig: HTMLElement): void {
  const svg = visibleSvg(fig);
  const dlg = document.getElementById('diagram-dialog') as HTMLDialogElement | null;
  const body = document.getElementById('diagram-dialog-body');
  if (!svg || !dlg || !body) return;
  const clone = svg.cloneNode(true) as SVGElement;
  clone.removeAttribute('width');
  clone.removeAttribute('height');
  clone.removeAttribute('style');
  clone.classList.add('expanded-svg');
  body.replaceChildren(clone);
  dlg.showModal();
}

function addToolbar(fig: HTMLElement, withFeedback: boolean): void {
  const bar = document.createElement('div');
  bar.className = 'diagram-toolbar';
  const src = button(LABELS.source, 'dg-source');
  src.setAttribute('aria-pressed', 'false');
  src.onclick = () => {
    const on = fig.classList.toggle('show-source');
    src.textContent = on ? LABELS.hide : LABELS.source;
    src.setAttribute('aria-pressed', String(on));
  };
  const exp = button(LABELS.expand, 'dg-expand', 'Show the diagram larger');
  exp.onclick = () => openExpanded(fig);
  bar.append(src, exp);
  if (withFeedback) {
    const fb = button(LABELS.feedback, 'dg-feedback');
    fb.onclick = () => document.dispatchEvent(new CustomEvent('rt:diagram-feedback', { detail: fig }));
    bar.append(fb);
  }
  fig.prepend(bar);
  // a diagram that has feedback opens the feedback list when clicked
  fig.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.diagram-toolbar') || !fig.dataset.fb) return;
    document.dispatchEvent(new CustomEvent('rt:diagram-click', { detail: fig }));
  });
}

// ---------------------------------------------------------------- scaling

/** Size each diagram from its viewBox and the presentation zoom, never wider than the reading column. */
function fitDiagrams(doc: HTMLElement): void {
  const zoom = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--doc-size')) || 1;
  doc.querySelectorAll<SVGSVGElement>('.diagram-svg > svg, .diagram-client > svg').forEach((svg) => {
    const w = svg.viewBox?.baseVal?.width;
    if (!w) return;
    svg.style.width = `px`;
    svg.style.maxWidth = '100%';
    svg.style.height = 'auto';
  });
}

// ---------------------------------------------------------------- Mermaid (client side)

const issues = new Map<HTMLElement, ClientDiag>();
let generation = 0;
let loader: Promise<typeof import('./mermaid-render.js')> | null = null;

function publish(): void {
  setClientDiagnostics('diagram', [...issues.values()]);
}

function fail(fig: HTMLElement, message: string, line?: number): void {
  const first = (message.split('\n')[0] ?? message).trim() || 'unknown error';
  fig.classList.add('failed');
  fig.dataset.diagramStatus = 'failed';
  const notice = fig.querySelector('.diagram-notice');
  if (notice) notice.textContent = `Diagram failed to render: ${first}`;
  const fenceLine = Number(fig.dataset.fenceLine ?? 0);
  issues.set(fig, { severity: 'warning', message: `Mermaid diagram failed to render: ${first}`, line: fenceLine + (line ?? 0) });
}

function race<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timed out after ${ms / 1000} s`)), ms);
    p.then((v) => (clearTimeout(t), resolve(v)), (e) => (clearTimeout(t), reject(e)));
  });
}

async function renderMermaidFigures(figs: HTMLElement[]): Promise<void> {
  const my = ++generation;
  const theme = currentTheme();
  loader ??= import('./mermaid-render.js');
  let mod: typeof import('./mermaid-render.js');
  try {
    mod = await loader;
  } catch (e) {
    for (const f of figs) fail(f, `the Mermaid library could not be loaded (${(e as Error).message})`);
    publish();
    return;
  }
  for (const [i, fig] of figs.entries()) {
    if (my !== generation) return; // a newer pass (theme change) took over
    const source = fig.dataset.diagramSource ?? '';
    try {
      const svg = await race(mod.renderMermaid(`rt-mmd-${my}-${i}`, source, theme), TIMEOUT_MS);
      if (my !== generation) return;
      const target = fig.querySelector('.diagram-client');
      if (target) target.innerHTML = svg;
      fig.classList.remove('failed');
      delete fig.dataset.diagramStatus;
      const notice = fig.querySelector('.diagram-notice');
      if (notice) notice.textContent = '';
      issues.delete(fig);
      fitDiagrams(fig.closest('#doc') as HTMLElement);
    } catch (e) {
      if (my !== generation) return;
      const msg = e instanceof Error ? e.message : String(e);
      const m = /line (\d+)/i.exec(msg);
      fail(fig, msg, m ? Number(m[1]) : undefined);
    }
    fig.dataset.rendered = '1';
  }
  publish();
}

export function initDiagrams(doc: HTMLElement, opts: { feedback: boolean }): void {
  const figs = Array.from(doc.querySelectorAll<HTMLElement>('figure.diagram'));
  if (!figs.length) {
    document.documentElement.dataset.diagramsReady = '1';
    return;
  }
  figs.forEach((f) => addToolbar(f, opts.feedback));
  fitDiagrams(doc);
  document.addEventListener('rt:layout', () => fitDiagrams(doc));
  document.addEventListener('themechange', () => fitDiagrams(doc));

  // server-rendered (D2) figures are final; failures reported by the server are already in the diagnostics
  figs.filter((f) => f.dataset.diagramLang !== 'mermaid').forEach((f) => (f.dataset.rendered = '1'));

  const mermaidFigs = figs.filter((f) => f.dataset.diagramLang === 'mermaid');
  const done = () => {
    document.documentElement.dataset.diagramsReady = '1';
  };
  if (mermaidFigs.length) {
    void renderMermaidFigures(mermaidFigs).then(done);
    const rerender = () => void renderMermaidFigures(mermaidFigs);
    document.addEventListener('themechange', rerender);
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (!document.documentElement.getAttribute('data-theme')) rerender();
    });
  } else {
    done();
  }

  // expanded-view dialog: close on the button or a click on the backdrop
  const dlg = document.getElementById('diagram-dialog') as HTMLDialogElement | null;
  document.getElementById('diagram-close')?.addEventListener('click', () => dlg?.close());
  dlg?.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close();
  });
}
