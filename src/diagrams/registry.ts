import type { DiagramRenderer, DiagramSettings } from './types.js';
import { DEFAULT_DIAGRAM_SETTINGS } from './types.js';
import { d2Renderer } from './d2.js';

/** Mermaid is rendered in the browser (bundled locally); the server only recognises the fence. */
export const mermaidRenderer: DiagramRenderer = {
  lang: 'mermaid',
  title: 'Mermaid',
  kind: 'client',
  render: async () => ({}),
};

/** The renderers for a render pass. Add PlantUML or others here; nothing else needs to change. */
export function renderersFor(settings: DiagramSettings = DEFAULT_DIAGRAM_SETTINGS): Map<string, DiagramRenderer> {
  const list: DiagramRenderer[] = [mermaidRenderer, d2Renderer(settings)];
  return new Map(list.map((r) => [r.lang, r]));
}
