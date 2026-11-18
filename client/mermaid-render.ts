import mermaid from 'mermaid';

/**
 * Mermaid is bundled locally (no CDN) and loaded lazily by diagrams.ts, only on pages with a Mermaid diagram.
 * securityLevel "strict" encodes HTML in labels and disables click handlers and scripts.
 */
let configuredFor: string | null = null;

function configure(theme: 'light' | 'dark'): void {
  if (configuredFor === theme) return;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: theme === 'dark' ? 'dark' : 'default',
    suppressErrorRendering: true,
    logLevel: 'fatal',
  });
  configuredFor = theme;
}

export async function renderMermaid(id: string, source: string, theme: 'light' | 'dark'): Promise<string> {
  configure(theme);
  try {
    const { svg } = await mermaid.render(id, source);
    return svg;
  } finally {
    // mermaid may leave its temporary render container in <body> when a diagram is invalid
    document.getElementById(`d${id}`)?.remove();
    document.getElementById(id)?.remove();
  }
}
