import { raw } from 'hono/html';
import type { Child } from 'hono/jsx';
import { indicatorFor, type Diagnostic } from '../render/diagnostics.js';
import type { CurrentDoc } from './app.js';

export function Page(props: { token: string; doc: CurrentDoc | null; navMaxLevel: number; sectionLevel: number; children?: Child }) {
  const diags = props.doc?.diagnostics ?? [];
  const hasDoc = !!props.doc?.html;
  const reviewable = hasDoc && !!props.doc?.sessionId;
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
        <script type="module" src="/static/client.js"></script>
      </head>
      <body>
        <header class="app-header">
          <span class="doc-title" title={props.doc?.sourceLabel}>
            {props.doc?.name ?? 'Document Review'}
          </span>
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
          {reviewable ? (
            <>
              <button type="button" id="btn-hl" aria-pressed="true" title="Show or hide feedback highlights">
                Highlights
              </button>
              <button type="button" id="btn-all-feedback" title="All feedback">
                Feedback <span id="all-count" class="count">0</span>
              </button>
              <button type="button" id="btn-doc-feedback" title="Feedback on the whole document">
                Document feedback
              </button>
              <button type="button" id="btn-participants" title="Participants">
                Participants
              </button>
              <button type="button" id="fb-summary" class="summary" aria-label="Feedback summary" title="Feedback summary"></button>
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
        {reviewable ? <FeedbackChrome /> : null}
      </body>
    </html>
  );
}

/** Static shells populated by client/*.ts: selection UI, tooltip, side panel, dialogs. */
function FeedbackChrome() {
  return (
    <>
      <div id="sel-ui" class="sel-ui" hidden>
        <button type="button" id="sel-add" hidden>
          Add feedback
        </button>
        <div id="sel-msg" class="sel-msg" role="status" hidden></div>
      </div>
      <div id="hl-tooltip" class="hl-tooltip" role="tooltip" hidden></div>
      <aside id="side-panel" class="panel" aria-label="Feedback" hidden></aside>
      <dialog id="fb-dialog" aria-labelledby="fb-title">
        <form id="fb-form" novalidate>
          <h2 id="fb-title">Add feedback</h2>
          <blockquote id="fb-quote" class="fb-quote" hidden></blockquote>
          <label>
            Reviewer
            <select id="fb-reviewer"></select>
          </label>
          <div id="fb-newreviewer" class="newrev" hidden>
            <input id="fb-newname" placeholder="New participant name" aria-label="New participant name" autocomplete="off" />
            <select id="fb-newrole" aria-label="New participant role">
              <option value="reviewer">reviewer</option>
              <option value="author">author</option>
            </select>
          </div>
          <fieldset>
            <legend>Status</legend>
            <label class="radio">
              <input type="radio" name="status" value="Reject" /> Reject
            </label>
            <label class="radio">
              <input type="radio" name="status" value="Accept with conditions" /> Accept with conditions
            </label>
            <label class="radio">
              <input type="radio" name="status" value="Accept" /> Accept
            </label>
          </fieldset>
          <label>
            Comment <span id="fb-req" class="hint">(optional)</span>
            <textarea id="fb-comment" rows={4} maxlength={20000}></textarea>
          </label>
          <p id="fb-error" class="error" role="alert" hidden></p>
          <div class="actions">
            <button type="button" id="fb-cancel">
              Cancel
            </button>
            <button type="submit" id="fb-save">
              Save
            </button>
          </div>
        </form>
      </dialog>
      <dialog id="import-dialog" aria-labelledby="imp-title">
        <h2 id="imp-title">Import feedback</h2>
        <div id="imp-body"></div>
        <div class="actions">
          <button type="button" id="imp-cancel">
            Cancel
          </button>
          <button type="button" id="imp-go">
            Import
          </button>
        </div>
      </dialog>
      <dialog id="confirm-dialog" aria-labelledby="confirm-text">
        <p id="confirm-text"></p>
        <div class="actions">
          <button type="button" id="confirm-no">
            Cancel
          </button>
          <button type="button" id="confirm-yes">
            Delete
          </button>
        </div>
      </dialog>
    </>
  );
}

export function StartForm(props: {
  token: string;
  recent: string[];
  error?: string;
  patSource: 'env' | 'session' | null;
  adoPicker?: { url: string; files: string[]; title?: string };
  /** a document is already displayed: tuck the loaders away so the document gets the screen */
  collapsed?: boolean;
}) {
  return (
    <details class="open-doc" id="open-doc" open={!props.collapsed}>
    <summary>{props.collapsed ? 'Open another document' : 'Open a document'}</summary>
    <section class="start" id="start-form">
      <form method="post" action="/load/local">
        <input type="hidden" name="_token" value={props.token} />
        <label>
          Markdown file path
          <input type="text" name="path" id="path-input" size={60} autocomplete="off" />
        </label>
        <button type="button" id="browse-file">Browse…</button>
        <button type="submit">Load</button>
        <span id="browse-msg" class="hint" role="status"></span>
      </form>
      <form method="post" action="/load/ado" id="ado-form" class="ado-form">
        <input type="hidden" name="_token" value={props.token} />
        <label>
          Azure DevOps pull request URL
          <input type="text" name="url" id="ado-url" size={60} autocomplete="off" placeholder="https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{id}" />
        </label>
        <label>
          Personal access token
          <input type="password" name="pat" id="ado-pat" size={30} autocomplete="off" spellcheck={false} />
        </label>
        <button type="submit">Load PR</button>
        <p class="hint" id="ado-pat-hint">
          {props.patSource === 'env'
            ? 'Leave the token empty to use the ADO_PAT environment variable.'
            : props.patSource === 'session'
              ? 'A token entered earlier is being used (kept in memory only). Enter a new one to replace it.'
              : 'Needs the Code (Read) scope. Or set ADO_PAT in the environment. The token is never stored.'}
        </p>
      </form>
      {props.error ? (
        <p class="error" role="alert" id="load-error">
          {props.error}
        </p>
      ) : null}
      {props.adoPicker ? (
        <section class="ado-picker" id="ado-picker" aria-label="Choose a document">
          <h2>Choose a document</h2>
          <p>
            {props.adoPicker.title ? `"${props.adoPicker.title}"` : 'This pull request'} adds {props.adoPicker.files.length} markdown files. Which one should be reviewed?
          </p>
          <ul>
            {props.adoPicker.files.map((f) => (
              <li>
                <form method="post" action="/load/ado">
                  <input type="hidden" name="_token" value={props.token} />
                  <input type="hidden" name="url" value={props.adoPicker!.url} />
                  <button type="submit" name="file" value={f} class="link">
                    {f}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
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
    </details>
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
        <div class="doc-wrap">
          <div id="margin-layer" class="margin-layer"></div>
        <article
          id="doc"
          class="doc"
          data-sha256={doc.sha256}
          data-section-level={String(props.sectionLevel)}
          data-nav-max-level={String(props.navMaxLevel)}
        >
          {raw(doc.html)}
        </article>
        <dialog id="diagram-dialog" class="diagram-dialog" aria-label="Diagram">
          <button type="button" id="diagram-close" class="icon" aria-label="Close">
            &times;
          </button>
          <div id="diagram-dialog-body"></div>
        </dialog>
        </div>
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
