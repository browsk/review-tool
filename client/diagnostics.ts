export interface ClientDiag {
  severity: 'warning' | 'error';
  message: string;
}

let base = { state: 'green', count: 0 };

export function initDiagnostics(): void {
  const btn = document.getElementById('diag-indicator');
  const panel = document.getElementById('diag-panel');
  if (!btn || !panel) return;
  base = { state: btn.dataset.state ?? 'green', count: Number(btn.dataset.count ?? 0) };
  btn.addEventListener('click', () => {
    const open = panel.hidden;
    document.dispatchEvent(new CustomEvent('rt:close-panels'));
    panel.hidden = !open;
  });
  document.addEventListener('rt:close-panels', () => {
    panel.hidden = true;
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

/** Merge issues found in the browser (orphaned feedback, unsupported API, ...) into the indicator and panel. */
export function setClientDiagnostics(list: ClientDiag[]): void {
  const btn = document.getElementById('diag-indicator');
  const panel = document.getElementById('diag-panel');
  if (!btn || !panel) return;
  panel.querySelectorAll('li.client-diag').forEach((n) => n.remove());
  let ul = panel.querySelector('ul.diag-list');
  if (list.length && !ul) {
    panel.replaceChildren();
    ul = document.createElement('ul');
    ul.className = 'diag-list';
    panel.append(ul);
  }
  for (const d of list) {
    const li = document.createElement('li');
    li.className = `client-diag sev-${d.severity}`;
    const sev = Object.assign(document.createElement('span'), { className: 'sev', textContent: d.severity });
    const line = Object.assign(document.createElement('span'), { className: 'line', textContent: '' });
    const msg = Object.assign(document.createElement('span'), { className: 'msg', textContent: d.message });
    li.append(sev, line, msg);
    ul!.append(li);
  }
  const count = base.count + list.length;
  const worstClient = list.some((d) => d.severity === 'error') ? 'red' : list.length ? 'orange' : 'green';
  const rank = { green: 0, orange: 1, red: 2 } as Record<string, number>;
  const state = rank[worstClient]! > rank[base.state]! ? worstClient : base.state;
  btn.dataset.state = state;
  btn.dataset.count = String(count);
  btn.className = `diag diag-${state}`;
  btn.setAttribute('aria-label', `Diagnostics: ${state}, ${count} issue${count === 1 ? '' : 's'}`);
  btn.title = `Diagnostics: ${count} issue${count === 1 ? '' : 's'}`;
  const c = btn.querySelector('.diag-count');
  if (c) c.textContent = count > 0 ? String(count) : '';
}
