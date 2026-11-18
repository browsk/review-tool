export type Theme = 'light' | 'dark';

export interface DiagramIssue {
  message: string;
  /** 1-based line within the diagram source, when known */
  line?: number;
}

export interface DiagramResult {
  /** sanitised SVG markup (server-rendered diagrams) */
  svg?: string;
  error?: DiagramIssue;
  warnings?: DiagramIssue[];
}

/**
 * A diagram language. Server renderers produce sanitised SVG here; client renderers (Mermaid) only declare the
 * language and are rendered in the browser. New languages (PlantUML, ...) plug in by implementing this interface
 * and registering it in registry.ts; the markdown pipeline does not change.
 */
export interface DiagramRenderer {
  /** fenced-code info string, lower case */
  lang: string;
  /** human name used in messages */
  title: string;
  kind: 'server' | 'client';
  render(source: string, theme: Theme): Promise<DiagramResult>;
}

export interface DiagramSettings {
  d2ThemeLight: number;
  d2ThemeDark: number;
  /** 'dagre' (default) or 'elk' */
  d2Layout: 'dagre' | 'elk';
  timeoutMs: number;
  maxSourceBytes: number;
}

export const DEFAULT_DIAGRAM_SETTINGS: DiagramSettings = {
  d2ThemeLight: 0,
  d2ThemeDark: 200,
  d2Layout: 'dagre',
  timeoutMs: 5000,
  maxSourceBytes: 100_000,
};
