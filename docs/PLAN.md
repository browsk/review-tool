# PLAN: Technical Documentation Review App (v1)

Status: draft for review. Source brief: `review-app-handover.md`.

## 1. Architecture

Single Node 22 process, bound to `127.0.0.1` (port configurable, LAN only with `--host-lan`).

```
Browser (facilitator, screen-shared)
  |  HTML (Hono JSX, htmx partials)      fetch/JSON (annotation API)
  v
Hono server (@hono/node-server)
  |-- routes/      pages + htmx partials + JSON API + static assets
  |-- render/      unified pipeline -> HTML with data-src-start/end, diagnostics
  |-- diagrams/    DiagramRenderer registry (d2 server-side, mermaid client-side marker)
  |-- sources/     local FS loader, ADO loader (both yield DocumentSource)
  |-- feedback/    model, anchoring, section model, CSV import/export
  |-- db/          better-sqlite3, migrations, repositories
  v
SQLite file (per-user data dir) + backups dir + ADO image cache dir
```

Division of labour: the server owns rendering, persistence, CSV, ADO, D2. The client owns selection capture, offset mapping, highlight drawing (CSS Custom Highlight API), keyboard navigation, and Mermaid. htmx drives panels, forms, lists and import/export dialogs. No SPA framework (revisit only after milestone 3, documented here if so).

### Key design decisions

- **Rendered-text offset model.** Offsets are character offsets into the *normalised rendered text* of the document body (concatenated text nodes in DOM order, excluding diagram SVG, app chrome, and elements marked `data-no-anchor`; block boundaries contribute a single `\n`; whitespace runs collapsed to one space). The same normalisation function is implemented once in a shared TS module (`src/shared/textmodel.ts`) and used by client (live DOM) and by unit tests (jsdom/happy-dom). The server never needs DOM offsets except for CSV re-anchoring, which also runs client-side after load; the server stores and returns anchors only.
- **Source positions** are carried via `data-src-start`/`data-src-end` on block elements for diagnostics-to-location jumps and diagram block anchoring. Text offsets (above) are the anchor of record.
- **Anchoring** per FR8: offsets verified against `quote_exact`, then quote + prefix/suffix search, else orphaned (stored with `orphaned=1` derived at attach time, not persisted as truth).
- **Highlights**: `CSS.highlights` with one `Highlight` per status plus a stacked "overlap depth" strategy (see 5.4). Diagram feedback uses an outline class on the diagram block.
- **Resilience**: each pipeline stage (`parse`, `lint`, `transform`, `highlight`, `sanitize`, `stringify`) wrapped in `safeStage()`, returning `{value, diagnostics}`; per-node rendering failures fall back to raw-source `<pre class="fallback">`.
- **Security**: image route resolves with `path.resolve` + `fs.realpath` and verifies the result is inside the document directory; rejects absolute paths, `..`, and symlinks escaping (403). rehype-sanitize with an explicit schema; SVG from D2 sanitised with DOMPurify (SVG profile) server-side via jsdom or a hand-rolled allowlist (decision in M5). All user text escaped by Hono JSX. PAT held in memory only. Host header check (reject non-localhost Host) and same-origin check on mutating routes to defend against DNS rebinding/CSRF from other local pages.

## 2. Module layout

```
package.json  tsconfig.json  esbuild.config.mjs  vitest.config.ts  playwright.config.ts
src/
  server/
    index.ts            CLI/config, start server
    config.ts           env/flags: PORT, HOST, DATA_DIR, SECTION_LEVEL, ADO_PAT, D2 theme IDs, layout
    app.tsx             Hono app wiring, middleware (host check, csrf)
    routes/             document.tsx, assets.ts, feedback.ts, participants.ts, csv.ts, ado.tsx, diagnostics.tsx
    views/              layout.tsx, header.tsx, panels/*.tsx
  render/
    pipeline.ts         unified chain + safeStage
    plugins/            positions.ts, fallback.ts, diagrams.ts, images.ts, lint.ts
    sanitize.ts
    diagnostics.ts      Diagnostic type, severity aggregation
    sections.ts         heading extraction, section boundaries (level configurable)
  diagrams/
    types.ts            DiagramRenderer interface
    d2.ts               D2.js wrapper, cache (sha256), timeout, TALA fallback, SVG sanitise
    mermaid.ts          fence detection + client hook descriptor
  sources/
    local.ts            path load, recent docs, safe asset resolver
    ado.ts              URL parse, REST client, change filter, image fetch/cache
  feedback/
    model.ts            types, validation
    anchor.ts           reattach algorithm (pure)
    csv.ts              export/import, injection guard, validation, report
    participants.ts     CSV/JSON parse + validation
  db/
    schema.sql migrations.ts repos.ts
  shared/
    textmodel.ts        normalised text + offset<->Range mapping
    sectionrules.ts     selection validation
client/
  main.ts annotate.ts keys.ts highlights.ts theme.ts zoom.ts diagrams.ts
public/                 built assets, fonts, d2 wasm (served locally)
test/
  fixtures/             arc42-good, malformed variants, diagrams, csv, participants, ado/*.json
  unit/ e2e/
examples/               arc42 sample (Mermaid + D2), participants sample
docs/                   PLAN.md, CSV_FORMAT.md
```

## 3. Data model (SQLite)

```
sessions(id TEXT PK, source_kind TEXT, source_key TEXT, doc_name TEXT, content_sha256 TEXT,
         created_at, updated_at, UNIQUE(source_key))
participants(id TEXT PK, session_id FK, name, email, role CHECK IN('author','reviewer'),
             UNIQUE(session_id, name COLLATE NOCASE))
feedback(id TEXT PK(UUID), session_id FK, scope CHECK IN('document','range'),
         status CHECK IN('Reject','Accept with conditions','Accept'),
         comment TEXT, reviewer_id FK, created_at, updated_at,
         start_offset INT, end_offset INT, quote_exact, quote_prefix, quote_suffix,
         section_heading, anchor_kind CHECK IN('text','diagram'), anchored_sha256 TEXT)
recent_documents(source_key PK, label, last_opened_at)
settings(key PK, value)   -- last reviewer per session, section level, etc.
```

- Session key = `local:<abs path>` or `ado:<org>/<project>/<repo>/<pr>/<file path>`; the content hash is stored on the session and compared on reload (FR14: mismatch warns and triggers re-anchor; session is resumed, not replaced, per assumption 5).
- Timestamps stored ISO 8601 with offset. DB in `DATA_DIR` (default: `%APPDATA%/review-tool`, `~/Library/Application Support/review-tool`, `$XDG_DATA_HOME/review-tool`). WAL mode. Schema versioned by `PRAGMA user_version` migrations.
- PAT never written anywhere; logger redacts `Authorization` and anything matching the PAT.

## 4. API / interaction outline

- `GET /` start page (path input, recent list, ADO URL input). `POST /load/local`, `POST /load/ado` (+ file picker partial), `GET /doc` main view.
- `GET /assets/*` scoped asset route (local dir or ADO cache).
- JSON: `GET/POST/PATCH/DELETE /api/feedback`, `GET/POST /api/participants`, `POST /api/participants/import`.
- CSV: `GET /export.csv`, `POST /import/preview`, `POST /import/commit` (mode=replace|merge; replace writes backup first).
- htmx partials: feedback panels, forms, diagnostics panel, import report, summary counts.

## 5. Component designs

### 5.1 Pipeline
Superseded order (see section 10, A.1): `remarkParse` -> `remarkFrontmatter` -> `remarkGfm` -> lint (diagnostics) -> positions -> `remark-rehype` (`allowDangerousHtml`) -> `rehype-raw` -> Shiki -> diagram plugin (D2 SVG pre-sanitised with DOMPurify; Mermaid left as `<pre class="mermaid" data-src>`) -> **`rehype-sanitize` last** with an explicit schema that allows exactly the generated markup (`data-src-*`, `data-section-id`, Shiki classes, sanitised SVG) -> `rehype-stringify`. Directive/math out of scope. Front matter goes to a metadata panel.

### 5.2 Section model and selection validation
`sections.ts` produces `[{id, heading, level, start, end}]` from the mdast at the configured level; the client mirrors it via `data-section-id` on a wrapper per section. `sectionrules.ts`: given start/end container nodes, find their section ids; allowed iff equal. A selection ending exactly at a section boundary (end offset == section end) is allowed; one more character is rejected. Content before the first section heading belongs to a synthetic section 0.

### 5.3 Selection capture
`selectionchange` + `mouseup` -> normalise via `textmodel` -> ignore collapsed/whitespace-only/chrome-originated -> validate -> either show floating button or inline message (dismissed on next click/selection). Selection touching a diagram snaps to the whole diagram block.

### 5.4 Highlight rendering
Build one `Range` per feedback item. Overlap depth: use N layered `Highlight` objects (`fb-sev-reject`, `-cond`, `-accept`, each with priority) and compute overlap segments client-side by splitting ranges at all boundaries, assigning each segment to a depth-N highlight (`depth-1..depth-4+`) so tint deepens; underline via `text-decoration` in the `::highlight()` rule using the max severity in the segment (CSS `::highlight` supports a limited property set, which includes background-color and text-decoration). Margin markers are DOM elements per block with counts. Tooltip and click use `caretPositionFromPoint`/`caretRangeFromPoint` to find items covering the point.

### 5.5 CSV
Columns exactly as FR10, `csv-stringify` with BOM, injection prefix `'` on cells beginning `= + - @` (plus tab and CR, a small deliberate extension), stripped on import only when the cell starts with `'` followed by one of those characters (so a genuine leading apostrophe survives). Import: parse, header check (order independent), per-row validation, preview report, then commit. Replace: automatic backup export to `DATA_DIR/backups/` first.

### 5.6 ADO
Parse both URL forms. REST: `GET pullRequests/{id}`, `iterations`, `iterations/{n}/changes`, items at `lastMergeSourceCommit` (use the latest iteration's `sourceRefCommit.commitId`). Filter `changeType` includes `add` and path ends `.md` (case-insensitive). Images resolved relative to the md path and fetched at the same commit, cached under `DATA_DIR/cache/<session>/` and served via the same scoped asset route. Mapped errors for 401/403/404. Pagination handled for changes (`$top`/`$skip`). Tests use a local mock server / injected `fetch`.

### 5.7 Diagrams
Interface `DiagramRenderer { lang; render(source, theme): Promise<{svg?:string; error?:{message,line?}}> }`. D2: renders light and dark variants, cached by `sha256(source+theme+layout)`; timeout implemented by running D2.js in a `worker_threads` worker that is terminated on timeout (WASM cannot otherwise be interrupted); TALA -> dagre fallback + warning; SVG sanitised. Mermaid: client-side with a per-diagram `Promise.race` timeout; theme swap re-renders. Failure -> highlighted source + notice + diagnostic. Click-to-expand, show-source toggle, hover "Add feedback on this diagram".

### 5.8 Navigation, presentation
`keys.ts` handles PageUp/Down, Home/End, Ctrl/Alt+Up/Down with an input/textarea/select/contenteditable guard. Sticky header driven by IntersectionObserver over headings. Theme (CSS variables, `prefers-color-scheme`, persisted in localStorage), zoom scales a CSS variable on the document column only, `prefers-reduced-motion` respected.

## 6. Milestones (order of work, each ends runnable with passing tests)

1. **Skeleton.** Scaffolding, config, Hono app, layout, theme toggle, local load, pipeline with positions, image route + traversal tests, diagnostics indicator + panel, fixtures (good, malformed, missing image, binary). Unit tests: pipeline, path safety.
2. **Navigation and presentation.** Section model, keys, sticky header, zoom, section buttons. Playwright: navigation, persistence.
3. **Range feedback.** textmodel, selection validation, anchor, highlights, feedback panels, participants (file + manual), SQLite + migrations, sessions. Decision gate: confirm no framework needed.
4. **Document feedback, export, import.** Document feedback UI, summaries, CSV export/import with all validation, merge/replace, backup, re-anchor on import/reload, orphans.
5. **ADO, diagrams, polish.** ADO loader + mocked tests, Mermaid + D2, diagram feedback, performance test (2,000 lines, 200 items, under 1 s), README, CSV_FORMAT.md, examples.

Definition of done per milestone: `npm test` green, `npm run test:e2e` green for implemented areas, `npm start` works.

## 7. Test strategy

Vitest for pure logic (with happy-dom/jsdom for textmodel), Playwright (Chromium; Firefox/WebKit smoke for the Highlight API) for UI in light and dark for highlight tests. Fixtures under `test/fixtures/`. Playwright global setup starts the app on a random port with a temp `DATA_DIR` and a mock ADO server. Network assertions via `page.on('request')` for no external calls. Performance test uses a generated 2,000-line document and 200 items with a measured budget.

## 8. Assumptions (beyond the brief's seven, which are accepted as written)

A1. "Normalised rendered text" is defined in 1 (collapsed whitespace, `\n` between blocks, diagram SVG and chrome excluded); offsets are in UTF-16 code units (JS string indices), documented in CSV_FORMAT.md.
A2. Content before the first section heading is a synthetic section 0.
A3. A selection that ends exactly at the start of the next section heading (zero characters in) is treated as within the earlier section.
A4. Windows, macOS, Linux supported; development and CI primarily Windows/Node 22.
A5. The "document name" is the file's base name without extension; `document_sha256` is the SHA-256 of the raw source bytes.
A6. Orphan state is computed on load and not persisted; orphans stay in the DB.
A7. The ADO "latest iteration source commit" is `sourceRefCommit.commitId` of the last iteration.
A8. Recent documents list holds the last 10 entries.
A9. Mermaid and D2 are only recognised in fenced blocks, not directives.
A10. Section heading level for navigation (Ctrl+Up/Down) defaults to all levels (1-6) and is separately configurable from the feedback section level.
A11. A Host-header check and same-origin check protect the unauthenticated local API (an addition beyond "no auth").
A12. CSV injection guard also covers leading tab/CR characters.
A13. Browser minimums: Chromium 105+, Firefox 140+, Safari 17.2+ (Custom Highlight API); documented in README, to be verified at M3.
A14. Editing a feedback item re-uses its anchor; anchors are not editable.
A15. Importing Replace deletes feedback only, not participants; imported unknown reviewers are added with role `reviewer`.
A16. Facilitator can add participants during a meeting without reload via htmx partial.

## 10. Review amendments (supersede earlier sections where they conflict)

Five single-theme reviews (security, anchoring, data/CSV, rendering/diagrams, milestones/testing) were run. Accepted changes:

### A. Rendering and resilience
1. Pipeline order as in 5.1 (sanitise last). Unit tests: `data-src-*`, Shiki markup and diagram SVG survive; XSS fixtures (`<img onerror>`, `javascript:`, `<svg onload>`, id clobbering, `hx-*` attributes) are stripped. Raw-HTML nodes get positions re-applied after `rehype-raw`.
2. Resilience: `tryNode(node, fn)` wrapper inside every visitor yields per-node raw `<pre class="fallback">`; the pipeline entry point catches whole-parse failure (raw `<pre>`, red). Binary detection: NUL byte or invalid UTF-8 -> red read failure. Lint rules mapped to severities: unclosed fence auto-closed, heading level skip, unknown link target, missing image (orange); bad front-matter YAML (orange); remark-lint `recommended` preset, warnings only.
3. Diagram line numbers: D2 error line + fence start line = document line. Mermaid errors are client-side and POSTed to `/api/diagnostics/client` (merged into the panel, indicator updates). Mermaid: `securityLevel: 'strict'`, lazy-loaded, per-diagram timeout marks it failed (hung main-thread renders cannot be cancelled; accepted and documented).
4. D2: one long-lived worker with warm-up before the timer starts, concurrency limit, restart after timeout, source-size cap. Cache key `sha256(source + variant + layout + d2Version + themeIds)`, in-memory LRU, failures cached briefly; light and dark rendered together. TALA detected by parsing `vars.d2-config.layout-engine` in the source, overridden, warning with line. WASM is served from `public/` and located explicitly (no `import.meta.url` reliance after bundling). **D2 and esbuild/WASM spike moves to M1.**
5. SVG sanitiser decided now: DOMPurify (SVG profile) with jsdom; forbid `foreignObject`, `script`, external `href`/`use`; keep `<style>`. Tested with real D2 output and malicious fixtures. Mermaid output also sanitised client-side.
6. ADO: latest iteration `sourceRefCommit.commitId` is authoritative (5.6 wording `lastMergeSourceCommit` is dropped). Strict host allowlist (`dev.azure.com`, `*.visualstudio.com`), `redirect: 'manual'`, URL-decoded project names, `changeType` treated as flags (`add, edit` counts only if it includes add), image paths normalised and `..`-escaping rejected, content-type and size limits, cache key sanitised. PAT sent by POST body only, `type=password`, never in partials, errors redacted.

### B. Security
1. Asset route: decode once; reject `\`, NUL, `:`, UNC and drive paths; `realpath` then `path.relative` containment (not string prefix); regular files only; image MIME allowlist (png/jpg/gif/webp); SVG only as `<img>` or with `Content-Security-Policy: sandbox`; `X-Content-Type-Options: nosniff`. Same rules for `POST /load/local` (size cap, no FIFOs/devices) and the ADO cache.
2. Headers: CSP `default-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`; Playwright asserts them.
3. Local API: Host allowlist (127.0.0.1, localhost, [::1] with port); Origin/Sec-Fetch-Site check on non-GET; JSON routes require `application/json`; per-process random token (header) on all mutating routes and on `/load/*` and `/export.csv`. `--host-lan` prints a warning and requires the token.
4. htmx: `allowEval=false`, `selfRequestsOnly=true`; sanitiser strips `hx-*`; client uses `textContent` for quotes/comments; no `raw()` with user text.
5. Logging redacts the PAT and Authorization; config dump omits `ADO_PAT`; paths/content not logged unnecessarily.

### C. Anchoring and highlighting
1. Text model specified per element class: `pre` verbatim; `<br>` = `\n`; table cells joined by a single space with `\n` per row; list items as blocks; collapsed/"Show source" nodes and all injected UI carry `data-no-anchor` and are skipped by the TreeWalker. A text-node index `{node, normStart, length}` maps offsets to Ranges. Golden fixtures pin the algorithm; a test asserts offsets are identical before and after Shiki/Mermaid/D2 run. Textmodel version stored in the DB and CSV_FORMAT.md; offsets are a hint, the quote is the real anchor.
2. Sections are half-open intervals over normalised text; validate `start` and `end-1`. This replaces A3's wording: a range whose last character lies in the next section is rejected. Imported rows are revalidated (warn, keep).
3. Re-anchor algorithm: (a) offset + quote verified; (b) exact quote hits scored by prefix+suffix; (c) nearest hit to old offset; (d) orphan. Result re-validated against section rules. Whitespace normalisation applied to quotes (CSV newline round-trip).
4. Diagrams get a one-character placeholder (`￼`) in the text model so offsets cover them; diagram rows are recognised by `quote_exact` matching a diagram fence source, re-anchored by source match. Diagram-snap logic and `anchor.ts` support for diagram blocks are built and unit-tested in M3.
5. Highlights: sweep-line segment computation (not O(n^2)); precomputed opaque colours per depth x severity x theme with contrast checks; feature-detect wrapper for `caretPositionFromPoint`/`caretRangeFromPoint`. M3 starts with a spike that has named pass criteria (overlap tint, underline by max severity, AA contrast, Firefox/Safari behaviour); Firefox limits go in the README.

### D. Data model and CSV
1. Sessions: unique on `source_key`; `content_sha256` updated only after re-anchoring on a changed hash; re-anchored offsets and `anchored_sha256` are written back so exports are never stale. Export `document_sha256` = current document hash. `sessions.last_reviewer_id` replaces the settings key.
2. Export mapping: `reviewer` = participant name, `reviewer_role` = role, `document_name` sanitised for illegal filename characters. `anchor_kind` is not exported (inferred on import per C.4).
3. Injection guard applies to every string cell (comment, reviewer, section_heading, quote_*). Cells that already begin with `'` followed by a trigger (`= + - @ \t \r`) are double-prefixed so strip-on-import is lossless. Offsets/prefix/suffix computed on original text. Property-based round-trip tests per column and leading character.
4. Import rule table (one test each): header check order-independent, BOM/CRLF tolerant, extra columns ignored; non-empty UUID `id`, duplicates in file reported; scope/status/role in allowed sets; comment required for Reject and Accept with conditions; reviewer non-empty; `created_at`/`updated_at` parse (created_at preserved); integer offsets >= 0, `end > start`, `quote_exact` for range rows; document rows ignore stray range fields; row-count and size limits.
5. Commit is one `better-sqlite3` transaction. Replace: backup written first (`DATA_DIR/backups/<doc>-<timestamp>.csv`, last 20 kept); a backup failure aborts; zero valid rows skips backup and delete. Preview-to-commit uses a server-side token holding the parsed upload and hash-mismatch state.
6. Participants matched case-insensitively; imported roles honoured; multiple authors raises the warning; `ON DELETE RESTRICT` for participants with feedback. Schema: `foreign_keys=ON`, WAL + busy timeout, CHECK `end_offset > start_offset` and scope-dependent nullability, indices on `session_id`, UTC epoch column beside the ISO timestamp for sorting.

### E. Milestones and testing (revised)
- M1 adds the D2/esbuild/WASM spike, security headers, Host/CSRF middleware, npm scripts, and the FR1 "previous document kept" and "binary -> red" tests.
- M2 adds a keyboard-guard unit test, Home/End, reduced-motion and reading-width checks, and theme/zoom persistence tests.
- M3 adds the highlight spike, diagram anchoring, FR5 participant error tests, Playwright "no shortcuts while typing", Firefox/WebKit Highlight smoke tests, dark-theme highlight tests, and an early perf check (tagged suite).
- M4 adds CSV_FORMAT.md and the hash-mismatch flows.
- M5 splits: **5a** ADO (mock ADO server in Playwright global setup), **5b** diagrams + diagram CSV round-trip, then perf enforcement (tagged `test:perf`, with margin), README (verified browser minimums), examples (sample arc42 with Mermaid and D2, participants file, source of the perf fixture).
- A global Playwright fixture fails any test that makes a non-local request.
- Scripts: `build`, `start` (builds then runs), `dev` (watch + reload), `test`, `test:e2e`, `test:perf`.
- Traceability: a table mapping each FR/AC to milestone and test file is created at the end of M1 and maintained per milestone in `docs/TRACEABILITY.md`.

## 9. Risks

- D2.js is pre-1.0 and WASM-in-worker packaging with esbuild needs an early spike (start of M5, or earlier if cheap).
- CSS `::highlight()` styling limits constrain the underline/overlap approach; spike at start of M3.
- Offset stability across Shiki/diagram transformations: text model must exclude generated decoration.
- 1-second performance budget with 200 ranges: batch DOM reads, build ranges once from a cached text-node index.

## 11. Progress log

- **M1 done.** Unit (39 passed, 1 skipped: symlink-escape test needs symlink rights on Windows) and Playwright (8) tests pass. Deviations: recent documents use `recent.json` in the data dir until SQLite lands in M3; `htmx` is not yet loaded (first needed in M3 panels); CSRF accepts `Origin: null` only with `Sec-Fetch-Site: same-origin` (Chrome sends it under `Referrer-Policy: no-referrer`).
- **D2 spike (done in M1).** `@terrastruct/d2` 0.1.33 (pinned exactly) renders under plain Node: dagre and elk both work, first render ~0.6 s (WASM warm-up), later ~80 ms. Compile errors are JSON with `range` and `errmsg` and a 1-based line, so line mapping is straightforward. Not yet verified: running it inside a `worker_threads` worker after esbuild bundling; that is the first task of M5b.
- **Environment note.** Node 26 is installed locally (the plan targets 22 LTS); `engines` is `>=22`. `better-sqlite3` prebuilds for Node 26 must be checked at the start of M3.
- **M2 done.** Unit (60 passed, 1 skipped) and Playwright (21) tests pass. Section model (`src/render/sections.ts`) stamps every top-level block with `data-section-id`; the preamble is section 0. Refinement of the section rule: a heading of depth === `SECTION_LEVEL` opens a section; a shallower heading after the first section also closes it and opens its own (so a late H1 does not fall into the previous H2 section); shallower headings before the first section stay in the preamble. Navigation: PageUp/Down scroll `innerHeight - header - 48px`; Ctrl/Alt+Up/Down jump between headings (all levels by default, `NAV_MAX_LEVEL` limits depth); from the very top the title is the first stop; at the end of a page where the last headings cannot align to the top, navigation steps by index and the breadcrumb shows the jumped-to heading. Zoom is 100-200% in 10% steps and scales `.doc` font-size only; persisted in localStorage and applied before first paint by `theme-init.js`. Verified in M2 tests: reading width 70-80ch and centred, reduced-motion CSS, typing guard (unit + Playwright). Firefox/WebKit are not yet run (scheduled for M3 with the Highlight API smoke tests).
- **M3 done.** Unit: 131 passed, 1 skipped. Playwright: 46 passed (Chromium: M1-M3; Firefox and WebKit: highlight smoke). `npm run test:perf` passes (2,018 lines + 200 items: client init 126 ms, ready 419 ms after navigation; budget 1 s).
  - **Highlight spike result (all three engines).** Translucent backgrounds from *separate* `Highlight` objects composite, so overlaps deepen; where two highlights paint an underline the higher `priority` wins (Chromium, Firefox). Within a *single* `Highlight` object overlapping ranges paint once and do not deepen, which an e2e pixel test caught for same-status overlaps. Resulting design: ranges are interval-coloured into layers (`src/shared/layers.ts`, max 5) and each (status, layer) pair is one `Highlight` (`rt-reject-0`...), priority = severity*10 + layer. The per-depth opaque-colour emulation from the review amendments is not needed. WebKit stacks the tint too, but no underline was detected in the sampled pixels, so in Safari severity is carried by tint colour plus the margin marker glyph (document in README at M5).
  - **Custom properties work in `::highlight()`**: `var(--hl-*)` resolves from the originating element, so light/dark themes share one set of rules. Contrast: `test/unit/palette.test.ts` proves WCAG AA (4.5:1) for body text under up to 5 stacked layers per status in both themes, 3:1 for underline colours, and that styles.css matches `src/shared/palette.ts`.
  - **Deviations.** (1) htmx is not used: panels and dialogs are rendered client-side from JSON state because highlights need the same state in the browser; revisit for the M4 import dialogs. (2) Recent documents still use `recent.json`. (3) The document-scope feedback API exists and is tested; its UI is M4. (4) Participant files are all-or-nothing (any bad row rejects the file); names already in the session are skipped and reported. (5) Sessions are keyed `local:<real path>`; `content_sha256` is updated only after the client re-anchors (`POST /api/session/reanchor`), and the hash-changed warning stays until then. (6) `createdEpoch` is exposed alongside `createdAt` because `createdAt` has second resolution and items are created faster than that.
  - **Text model v1** (`src/shared/textmodel.ts`) is specified in its header comment; `TEXTMODEL_VERSION` is stored per feedback row. Diagram blocks (`data-diagram-lang`) already contribute one `U+FFFC` placeholder and snap selections to the whole block (unit-tested); diagram rendering and diagram feedback UI land in M5b.
  - **Known gaps carried forward.** Orphan/hash flows are tested through the UI, but CSV round-trip of anchors is M4. Firefox/WebKit are smoke-tested only; the full UI suite runs on Chromium.
- **M4 done.** Unit: 194 passed, 1 skipped. Playwright: 57 passed (stable over repeated full runs). Perf unchanged (page ready ~414 ms).
  - **Delivered.** Whole-document feedback (form, panel, filters, sort, summary chip); CSV export (`GET /export.csv`) and two-step import (`/api/import/preview` then `/api/import/commit`, Merge default / Replace with automatic backup, single transaction, token-based hand-off, per-row validation, orphan and hash-mismatch reporting); `docs/CSV_FORMAT.md` and `examples/feedback-example.csv`; participant role changes in place (`PATCH /api/participants/:id`) and the friendly author-count wording agreed with the user.
  - **Decisions / deviations.** (1) Timestamps now carry milliseconds (still ISO 8601 with offset) so ordering survives an export and re-import. (2) The export/import controls live in the All feedback panel toolbar rather than the header, to keep the header on one line. (3) `GET /export.csv` is protected by the Host check only (a browser download link cannot send the token header; a cross-site page cannot read the response). (4) Replace writes the backup only when there is existing feedback to lose. (5) Required import columns are id, scope, status, reviewer, created_at, comment, start_offset, end_offset, quote_exact; all others are optional. (6) An imported item that now spans two sections is kept and flagged in diagnostics instead of being rejected. (7) ids belonging to another review session are reported as conflicts (the feedback table's primary key is global).
  - **Test infrastructure fixes.** The e2e helper now waits for a genuinely new document after submitting the load form (the start page still shows the previous document). One milestone 3 test had a false pass (non-adjacent paragraphs; no wait for the rAF-scheduled handler); both corrected. Two real findings worth keeping: `Response.text()` drops a UTF-8 BOM (assert on bytes), and a page CSP of `connect-src 'self'` rightly blocks `fetch('data:...')` in tests.
