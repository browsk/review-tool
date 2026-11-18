# Technical Documentation Review App

A locally hosted web app for running live review meetings on technical documents written in Markdown. The
facilitator screen-shares the app to a TV and to remote attendees, records feedback on behalf of whoever is
speaking (against the whole document, a selected passage, or a diagram), and exports everything to CSV.

The app is **view only**: it never edits the source document. It runs on the facilitator's machine and is not a
multi-user web service.

- Markdown with GFM tables, task lists, footnotes, front matter, syntax-highlighted code, and **Mermaid** and
  **D2** diagrams
- Load from a local file or from an **Azure DevOps pull request**
- Range feedback anchored to the text (survives edits to the document), with overlapping highlights
- Whole-document feedback, participants, filters, CSV export and import
- Light and dark themes, presentation zoom, keyboard navigation, nothing loaded from the internet

## Quick start

Requires **Node.js 22 or newer** (developed on Node 26) and a current browser (see [Supported browsers](#supported-browsers)).

```bash
npm install
npm start          # builds the client and serves http://127.0.0.1:3000
```

Open <http://127.0.0.1:3000>, paste the path of a Markdown file and press **Load**. To try it out use
`examples/arc42-sample.md` (an arc42 document with Mermaid and D2 diagrams, a table, code and an image) or
`examples/arc42-large.md` (about 1,300 lines, for trying navigation and overlapping feedback). Then open
**Participants** and import `examples/participants.csv`.

`npm run dev` runs the server with auto-reload and rebuilds the client on change.

| Command | What it does |
|---|---|
| `npm start` | Build the client, then run the app |
| `npm run dev` | Development mode: rebuild and restart on change |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Browser tests (Playwright) in Chromium, Firefox and WebKit |
| `npm run test:perf` | Performance check: 2,000-line document with 200 feedback items |
| `npm run typecheck` | TypeScript, strict mode |

The first time you run the browser tests: `npx playwright install chromium firefox webkit`.

## Using the app

1. **Load a document.** Enter a file path, pick one from *Recent documents*, or enter an Azure DevOps pull request
   URL (see below). A small dot in the header shows document health: green (no issues), orange (warnings such as a
   missing image, a heading level skip, an unclosed code fence, or a diagram that failed to render) or red (the file
   could not be read). Click it for the list; clicking an issue scrolls to it.
2. **Add participants** (header: *Participants*): type them in, add them from the feedback form, or import a CSV or
   JSON file with a `name` column (optional `email` and `role` of `author` or `reviewer`). Exactly one author is
   expected; the panel tells you if none or several are set, and each participant's role can be changed in place.
   The form remembers the last reviewer used, so you can capture a run of comments from one person quickly.
3. **Give feedback.**
   - *On text:* select text with the mouse. An **Add feedback** button appears; the form shows the quoted text,
     the reviewer, a status (**Reject**, **Accept with conditions**, **Accept**) and a comment (required for Reject
     and Accept with conditions).
   - *On the whole document:* **Document feedback** in the header.
   - *On a diagram:* hover a diagram and use **Add feedback on this diagram**. Text selected inside a diagram snaps
     to the whole diagram.
4. **See it.** Text with feedback gets a tint and underline in the status colour; where ranges overlap the tint
   deepens and the most severe status colours the underline. Each block with feedback gets a margin marker with a
   count (a shape and a number, so it does not rely on colour alone). Hover for a summary; click text or a marker
   to list **every** item covering that point, and click an item to flash its exact range. Diagrams with feedback
   get an outline. **Highlights** hides all of it (handy when reading aloud on screen).
5. **Review everything** in **Feedback** (filter by status and reviewer, sort by date; items whose text can no longer
   be found are listed under *Could not locate in document*), and use **Export CSV** / **Import CSV...** there.

### Sections and the selection limit

A *section* is an H2 and everything up to the next H2 (so H3 subsections belong to their parent). A selection may
sit inside at most one section; selecting across two shows a message naming both. Content before the first H2
(the title and introduction) is its own section. The heading level is configurable (`SECTION_LEVEL`).

### Documents that change

Each document has a review session keyed by its path (or pull request and file). Feedback is stored with the quoted
text and its surroundings. If the document changes, a warning appears and every item is re-attached: by its stored
position if that still matches, otherwise by the quote (using the surrounding text to choose between several
matches), otherwise it is kept and listed as not located. Nothing is lost.

## Keyboard shortcuts

| Key | Action |
|---|---|
| PageUp / PageDown | Scroll one viewport (minus a small overlap) |
| Home / End | Start / end of the document |
| Ctrl+Up / Ctrl+Down | Previous / next heading (any level; `NAV_MAX_LEVEL` limits the depth) |
| Alt+Up / Alt+Down | Same as Ctrl+Up / Ctrl+Down |

Shortcuts never fire while you are typing in an input, text box or select, nor while a dialog is open. On-screen
previous/next buttons and a sticky breadcrumb in the header show where the discussion is.

**macOS:** Ctrl+Up and Ctrl+Down are captured by Mission Control by default, so use **Alt+Up / Alt+Down** (or
turn those system shortcuts off under System Settings > Keyboard > Keyboard Shortcuts > Mission Control).

## Configuration

Set environment variables before `npm start`, or pass the flags shown.

| Setting | Default | Meaning |
|---|---|---|
| `PORT` or `--port=N` | `3000` | Port to listen on |
| `--host-lan` | off | Listen on all interfaces instead of 127.0.0.1. There is **no login**, and the file box can load any `.md` file on this machine. Only use on a trusted network. |
| `REVIEW_TOOL_DATA_DIR` | per user (below) | Where feedback, backups and caches are stored |
| `SECTION_LEVEL` | `2` | Heading depth that opens a feedback section (1-6) |
| `NAV_MAX_LEVEL` | `6` | Deepest heading level that Ctrl/Alt+Up/Down stop at |
| `ADO_PAT` | unset | Azure DevOps personal access token (alternative to typing it in the UI) |
| `D2_THEME_LIGHT` / `D2_THEME_DARK` | `0` / `200` | D2 theme ids for the light and dark variants of each diagram |
| `D2_LAYOUT` | `dagre` | D2 layout engine: `dagre` or `elk` |
| `DIAGRAM_TIMEOUT_MS` | `5000` | Per-diagram render timeout |

**Data directory** (created on first use): `%APPDATA%\review-tool` on Windows,
`~/Library/Application Support/review-tool` on macOS, `$XDG_DATA_HOME/review-tool` (or `~/.local/share/review-tool`)
on Linux. It holds `review.db` (SQLite: sessions, participants, feedback; copy this file to back everything up),
`backups/` (automatic CSV backups made before a *Replace* import; the 20 most recent are kept), `cache/ado/`
(images from pull requests) and `recent.json`.

## Azure DevOps pull requests

Enter a URL of the form `https://dev.azure.com/{organisation}/{project}/_git/{repository}/pullrequest/{id}`
(the older `https://{organisation}.visualstudio.com/{project}/_git/{repository}/pullrequest/{id}` form is accepted
too) and a personal access token with the **Code (Read)** scope, or set `ADO_PAT`.

- The app looks at the files the pull request **adds** with a `.md` extension (modified files are out of scope for
  v1). None: you get a clear message. One: it loads. Several: you choose from a list.
- The file and the relative images it references are fetched at the pull request's latest source commit; images are
  cached locally.
- A rejected token, missing access and an unknown pull request each give their own message.
- The token is used only for requests to Azure DevOps. It is held in memory (and only after Azure DevOps has
  accepted it), never written to the database, cache, logs or exports, and redirects are never followed.

## Diagrams

Fenced code blocks with the info string `mermaid` or `d2` are rendered as diagrams.

- **Mermaid** renders in the browser from a locally bundled copy (`securityLevel: strict`). The library is a
  separate chunk that is only downloaded for documents that contain a Mermaid diagram, and the diagram re-renders
  when you switch themes.
- **D2** renders on the server with [D2.js](https://github.com/terrastruct/d2) (WebAssembly; no `d2` binary
  needed). **D2.js is pre-1.0, so the version is pinned to exactly 0.1.33.** Light and dark variants are rendered
  and swapped by the theme toggle. Results are cached by source, theme, layout, D2 version and theme ids.
- **TALA** (D2's proprietary layout engine) is not part of D2.js. A diagram that requests `layout-engine: tala`
  is rendered with the default engine and a warning appears in the diagnostics list.
- A diagram that fails (syntax error, timeout, library failure) shows its source with a notice, a warning with
  the line number in the document is added to the diagnostics, and the rest of the document is unaffected. Each
  diagram has a 5 second timeout (D2's worker thread is terminated and replaced if it hangs).
- Each diagram has **Show source**, **Expand**, and scales with the presentation zoom and the reading width.
- Generated SVG is sanitised (no scripts, links, animation, event handlers, or external URLs) before it is inlined.
- Adding another language (for example PlantUML) means implementing the small `DiagramRenderer` interface in
  `src/diagrams/types.ts` and registering it in `src/diagrams/registry.ts`.

## CSV export and import

One CSV (UTF-8 with BOM, RFC 4180) holds both document and range feedback, with a header row and these columns:
`id, document_name, document_sha256, scope, status, reviewer, reviewer_role, created_at, updated_at, comment,
section_heading, start_offset, end_offset, quote_exact, quote_prefix, quote_suffix`.

Import shows a confirmation (row counts, counts by scope and status, a warning if the document differs) and offers
**Merge** (add; existing ids are skipped as duplicates) or **Replace** (an automatic backup is written first).
Invalid rows are skipped and listed with reasons; valid rows still import. Cells that start with `=`, `+`, `-`, `@`
are neutralised against spreadsheet formula injection and restored on import.

Full specification, validation rules and an example: [`docs/CSV_FORMAT.md`](docs/CSV_FORMAT.md) and
[`examples/feedback-example.csv`](examples/feedback-example.csv).

## Supported browsers

Feedback highlights use the **CSS Custom Highlight API**, which sets the minimum versions:

| Browser | Minimum | Tested with |
|---|---|---|
| Chrome / Edge | 105 | Chromium 159 |
| Firefox | 140 | Firefox 159 |
| Safari | 17.2 | WebKit 27.2 (Playwright) |

In a browser without the API the app still works and shows a warning in the diagnostics; margin markers and the
feedback panels remain available, only the text tint and underline are missing.
In Safari the tint stacks as in the other browsers, but the severity **underline** may not be drawn; severity is
then carried by the tint colour and the margin marker's shape and count.
The reviewers' browser does not matter for the facilitator's screen share: only the facilitator's browser runs the app.

## Security notes

- Listens on `127.0.0.1` only unless `--host-lan` is given. Requests with an unexpected `Host` header are
  refused (DNS-rebinding defence); changing requests also need a per-process token and a same-origin request.
- A strict Content Security Policy (no inline scripts, no external origins) is sent with every page; the app makes
  no network calls except to Azure DevOps. Fonts, scripts and styles are bundled (Atkinson Hyperlegible Next and Mono, Zilla Slab; SIL OFL, see public/fonts/LICENSES.txt).
- All rendered Markdown is sanitised after rendering; user-entered text is escaped. Relative images are served only
  from the document's directory (traversal, absolute, UNC, drive-letter, encoded and symlink escapes return 403)
  and only as images; SVG images are served in a sandbox.

## Project layout

```
src/server       Hono app, routes, views (server-rendered JSX), configuration
src/render       unified/remark pipeline, sanitiser, section model, diagram integration
src/diagrams     D2 service, SVG sanitiser, renderer registry
src/sources      local files, Azure DevOps client
src/feedback     model, participants, CSV, backups
src/db           SQLite schema, migrations, repositories
src/shared       text model, section rules, re-anchoring, layers, palette (used by server and browser)
client           browser code (selection, highlights, panels, diagrams, navigation); bundled with esbuild
public           styles and built assets
test             unit tests, Playwright tests, fixtures (including deliberately malformed documents)
examples         sample documents, participant files, example CSV
docs             PLAN.md (architecture and decisions), TRACEABILITY.md, CSV_FORMAT.md
```

## Known limitations (v1)

- One facilitator operates the app; there is no real-time collaboration and no login.
- Only files **added** by a pull request are loaded; modified-file diffs are not handled. Pull-request documents
  do not appear in *Recent documents*.
- Diagram feedback is anchored to the diagram's source text: editing a diagram's source makes its feedback "not
  located" (it is kept and shown in the list).
- D2's TALA layout engine is unavailable; Mermaid and D2 are the only diagram languages.
- On Windows the symlink-escape unit test is skipped unless symlinks can be created (it needs Developer Mode or
  elevation). The protection itself is not platform-specific.
