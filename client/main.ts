import { initTheme } from './theme.js';
import { initDiagnostics } from './diagnostics.js';
import { initNavigation } from './nav.js';
import { initZoom } from './zoom.js';
import { store } from './store.js';
import { draw, initHighlightInteraction, initModel, highlightsVisible, resolveAnchors, setHighlightsVisible } from './highlights.js';
import { initSelection } from './annotate.js';
import { initPanels } from './panels.js';

import { initDiagrams } from './diagrams.js';

initTheme();
initDiagnostics();
initZoom();
initNavigation();
{
  const doc = document.getElementById('doc');
  if (doc) initDiagrams(doc, { feedback: !!document.getElementById('fb-dialog') });
}

async function initFeedback(): Promise<void> {
  const doc = document.getElementById('doc');
  if (!doc || !document.getElementById('fb-dialog')) return;
  performance.mark('rt-feedback-start');
  if (!(await store.load())) return;
  initModel(doc);
  await resolveAnchors();
  initHighlightInteraction();
  initSelection(doc);
  initPanels();
  const btn = document.getElementById('btn-hl');
  const sync = () => btn?.setAttribute('aria-pressed', String(highlightsVisible()));
  btn?.addEventListener('click', () => {
    setHighlightsVisible(!highlightsVisible());
    sync();
  });
  sync();
  draw();
  performance.mark('rt-feedback-ready');
  performance.measure('rt-feedback-init', 'rt-feedback-start', 'rt-feedback-ready');
  document.documentElement.dataset.feedbackReady = '1';
}

void initFeedback();
