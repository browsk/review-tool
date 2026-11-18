export function initDiagnostics(): void {
  const btn = document.getElementById('diag-indicator');
  const panel = document.getElementById('diag-panel');
  if (!btn || !panel) return;
  btn.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
  });
  panel.addEventListener('click', (e) => {
    const li = (e.target as HTMLElement).closest('li[data-src-start]') as HTMLElement | null;
    if (!li) return;
    const start = Number(li.dataset.srcStart);
    const blocks = Array.from(document.querySelectorAll<HTMLElement>('#doc [data-src-start]'));
    // the innermost/last block starting at or before the diagnostic offset
    let target: HTMLElement | undefined;
    for (const b of blocks) {
      if (Number(b.dataset.srcStart) <= start) target = b;
      else break;
    }
    target?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
}
