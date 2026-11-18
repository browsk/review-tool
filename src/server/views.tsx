import { raw } from 'hono/html';
import type { Child } from 'hono/jsx';
import { indicatorFor, type Diagnostic } from '../render/diagnostics.js';
import type { CurrentDoc } from './app.js';

export function Page(props: { token: string; doc: CurrentDoc | null; navMaxLevel: number; sectionLevel: number; children?: Child }) {
  const diags = props.doc?.diagnostics ?? [];
  const hasDoc = !!props.doc?.html;
  const ind = props.doc ? indicatorFor(diags) : 'none';
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="review-token" content={props.token} />
        <title>{props.doc ? `${props.doc.name} - Review` : 'Document Review'}</title>
        <script src="/static/theme-init.js"></script>
        <link rel="stylesheet" href="/static/styles.css" />
        <script src="/static/client.js" defer></script>
      </head>
      <body>
        <header class="app-header">
          <span class="doc-title">{props.doc?.name ?? 'Document Review'}</span>
          {hasDoc ? (
            <nav id="breadcrumb" class="breadcrumb" aria-label="Current section" aria-live="polite"></nav>
          ) : null}
          <span class="spacer"></span>
          {hasDoc ? (
            <>
              <span class="group" role="group" aria-label="Section navigation">
                <button type="button" id="prev-section" title="Previous section (Ctrl/Alt+Up)" aria-label="Previous section">
                  &#9650;
                </button>
                <button type="button" id="next-section" title="Next section (Ctrl/Alt+Down)" aria-label="Next section">
                  &#9660;
                </button>
              </span>
              <span class="group" role="group" aria-label="Zoom">
                <button type="button" id="zoom-out" aria-label="Zoom out" title="Zoom out">
                  A-
                </button>
                <output id="zoom-label" aria-live="off">
                  100%
                </output>
                <button type="button" id="zoom-in" aria-label="Zoom in" title="Zoom in">
                  A+
                </button>
              </span>
            </>
          ) : null}
          <button
            type="button"
            id="diag-indicator"
            class={`diag diag-${ind}`}
            data-state={ind}
            data-count={String(diags.length)}
            aria-label={`Diagnostics: ${ind}, ${diags.length} issue${diags.length === 1 ? '' : 's'}`}
            title={`Diagnostics: ${diags.length} issue${diags.length === 1 ? '' : 's'}`}
          >
            <span class="dot"></span>
            <span class="diag-count">{diags.length > 0 ? diags.length : ''}</span>
          </button>
          <button type="button" id="theme-toggle" aria-label="Toggle theme">
            Theme
          </button>
        </header>
        <aside id="diag-panel" class="panel" hidden>
          <DiagnosticsPanel diagnostics={diags} />
        </aside>
        <main>{props.children}</main>
      </body>
    </html>
  );
}

export function StartForm(props: { token: string; recent: string[]; error?: string }) {
  return (
    <section class="start" id="start-form">
      <form method="post" action="/load/local">
        <input type="hidden" name="_token" value={props.token} />
        <label>
          Markdown file path
          <input type="text" name="path" id="path-input" size={60} autocomplete="off" />
        </label>
        <button type="submit">Load</button>
      </form>
      {props.error ? (
        <p class="error" role="alert" id="load-error">
          {props.error}
        </p>
      ) : null}
      {props.recent.length > 0 ? (
        <details class="recent">
          <summary>Recent documents</summary>
          <ul>
            {props.recent.map((r) => (
              <li>
                <form method="post" action="/load/local">
                  <input type="hidden" name="_token" value={props.token} />
                  <input type="hidden" name="path" value={r} />
                  <button type="submit" class="link">
                    {r}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

export function DocumentView(props: { doc: CurrentDoc; navMaxLevel: number; sectionLevel: number }) {
  const { doc } = props;
  return (
    <>
      {doc.frontmatter ? (
        <details class="metadata">
          <summary>Document metadata</summary>
          <pre>{doc.frontmatter}</pre>
        </details>
      ) : null}
      {doc.html ? (
        <article
          id="doc"
          class="doc"
          data-sha256={doc.sha256}
          data-section-level={String(props.sectionLevel)}
          data-nav-max-level={String(props.navMaxLevel)}
        >
          {raw(doc.html)}
        </article>
      ) : (
        <p class="empty">The document could not be read. See diagnostics.</p>
      )}
    </>
  );
}

export function DiagnosticsPanel(props: { diagnostics: Diagnostic[] }) {
  if (props.diagnostics.length === 0) return <p>No issues.</p>;
  return (
    <ul class="diag-list">
      {props.diagnostics.map((d) => (
        <li class={`sev-${d.severity}`} data-src-start={d.srcStart !== undefined ? String(d.srcStart) : undefined}>
          <span class="sev">{d.severity}</span>
          <span class="line">{d.line ? `line ${d.line}` : ''}</span>
          <span class="msg">{d.message}</span>
        </li>
      ))}
    </ul>
  );
}
