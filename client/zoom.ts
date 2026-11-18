import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP, clampZoom } from './navlogic.js';

const KEY = 'rt-zoom';

function stored(): number {
  try {
    return clampZoom(Number(localStorage.getItem(KEY) ?? ZOOM_MIN));
  } catch {
    return ZOOM_MIN;
  }
}

export function initZoom(): void {
  const label = document.getElementById('zoom-label');
  const out = document.getElementById('zoom-out') as HTMLButtonElement | null;
  const inn = document.getElementById('zoom-in') as HTMLButtonElement | null;
  let pct = stored();

  const apply = () => {
    document.documentElement.style.setProperty('--doc-size', String(pct / 100));
    if (label) label.textContent = `${pct}%`;
    if (out) out.disabled = pct <= ZOOM_MIN;
    if (inn) inn.disabled = pct >= ZOOM_MAX;
  };
  const set = (v: number) => {
    pct = clampZoom(v);
    try {
      localStorage.setItem(KEY, String(pct));
    } catch {
      /* storage unavailable */
    }
    apply();
  };
  out?.addEventListener('click', () => set(pct - ZOOM_STEP));
  inn?.addEventListener('click', () => set(pct + ZOOM_STEP));
  apply();
}
