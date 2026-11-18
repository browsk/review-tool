# Handover: Technical Documentation Review App (v1)

## Your task

Build a locally hosted web app for running live review meetings on technical documents written in markdown. The meeting facilitator screen-shares the app to a TV and to remote attendees. Reviewers' feedback is captured against the whole document or against selected text, then exported to CSV.

Before writing code:

1. Read this whole brief.
2. Write `docs/PLAN.md` covering architecture, module layout, data model, and the milestone order you intend to follow.
3. List any assumptions you make beyond those in the "Assumptions" section at the end. Proceed with your best judgement rather than stopping, but record every assumption in `docs/PLAN.md` so it can be reviewed.

Work in milestones (see "Milestones"). Each milestone must leave the app runnable with passing tests.

---

## Context

- Documents are typically a single page structured like arc42 (H1 title, H2 numbered sections such as "1. Introduction and Goals", "3. Context and Scope", with H3 subsections).
- Documents may reference local images via relative paths. All files needed to render the document will be available alongside it.
- The app is view only. It never edits the source document.
- The app runs on the facilitator's machine. It is not a multi-user web service. One facilitator drives the UI and records feedback on behalf of whoever is speaking.

---

## Tech stack

Default stack: **Hono + htmx**. Use it, with the following additions and caveats.

### Recommended stack

| Concern | Choice | Reason |
|---|---|---|
| Runtime | Node 22 LTS (or Bun if you find a strong reason, document it) | Mature, Playwright and SQLite bindings are well supported |
| Language | TypeScript, strict mode, throughout | Shared types between server and client |
| Server | Hono with `@hono/node-server` | As requested |
| Server-rendered UI | Hono JSX + htmx | Panels, dialogs, feedback lists, import/export flows |
| Client interaction layer | Small vanilla TypeScript module bundled with esbuild | See flag below |
| Markdown | unified / remark / rehype | See flag below |
| Persistence | SQLite via `better-sqlite3` | Single file, survives restarts, trivial to back up |
| CSV | `csv-parse` and `csv-stringify` | RFC 4180 correct handling of quotes, commas, newlines |
| Diagrams | `mermaid` (client) and `@terrastruct/d2` (server, WASM) | See FR3a |
| Unit tests | Vitest | |
| UI tests | Playwright | |

### Flag 1: htmx alone is not enough for the annotation layer

htmx is a good fit for server-driven UI (panels, forms, lists, import/export). It is a poor fit for the core interaction of this app, which is entirely client-side:

- Capturing a mouse text selection and mapping it to stable document offsets
- Validating the selection against section boundaries in real time
- Drawing overlapping highlights without mutating the rendered DOM
- Keyboard navigation (PageUp/PageDown/Home/End/Ctrl+Up/Ctrl+Down)

Write this as a focused client module (`client/annotate.ts`, `client/keys.ts`) that talks to the server through plain `fetch` or by triggering htmx events. Do not pull in a SPA framework. If, after building milestone 3, you conclude a framework would materially reduce complexity, stop and document the case in `docs/PLAN.md` instead of switching silently.

### Flag 2: use unified/remark rather than markdown-it or marked

The requirements for resilient rendering, a diagnostics list, and stable anchoring all depend on having a source-positioned AST. remark gives:

- `mdast` nodes with line/column/offset positions for every node
- `remark-lint` presets that produce warnings without blocking rendering
- `remark-gfm` (tables, strikethrough, task lists, autolinks, footnotes)
- `remark-frontmatter`, `remark-directive`, `remark-math` for the other common flavours
- `rehype-sanitize` for safe handling of raw HTML in markdown

Carry source offsets through to the rendered HTML as `data-src-start` / `data-src-end` attributes on block elements so selections can be mapped back to the source text.

### Flag 3: use the CSS Custom Highlight API for feedback highlights

Overlapping feedback ranges are a core requirement. Wrapping text in `<mark>` elements breaks down quickly when ranges overlap or cross element boundaries. Use `CSS.highlights` with `Highlight` objects built from `Range`s. This draws highlights without changing the DOM, handles overlap natively, and is supported in current Chromium, Firefox, and Safari. Document the minimum browser versions in the README.

---

## Functional requirements

Each requirement has acceptance criteria (AC). Tests must cover the ACs.

### FR1. Document loading: local filesystem

- The user picks a `.md` file from the local filesystem. Provide both a file path input (server reads it) and a "recent documents" list.
- Relative image paths resolve against the document's directory. The server serves them through a route scoped to that directory only. Requests that escape the directory (`..`, absolute paths, symlinks out) return 403.
- Missing images render a visible placeholder with the broken path, and add a warning to diagnostics.

AC:
- Loading a valid document renders it and shows a green diagnostics indicator.
- Loading a non-existent path shows a clear error and leaves the previous document (if any) displayed.
- Loading a non-markdown or binary file shows a red indicator with a read failure entry.
- An image reference of `../../etc/passwd` is not served.

### FR2. Document loading: Azure DevOps pull request

- The user provides an Azure DevOps PR URL (`https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{id}`). Also accept the legacy `{org}.visualstudio.com` form.
- Authenticate with a Personal Access Token read from an environment variable (`ADO_PAT`) or entered in the UI. Never persist the PAT to the database, logs, or exported files.
- Use the ADO REST API to find files **added** in the PR (iteration changes with `changeType` add) with a `.md` extension.
  - Zero found: show a clear message.
  - One found: load it.
  - Multiple found: show a picker listing each path and let the user choose.
- Fetch the file content from the PR's source branch at the latest iteration's source commit.
- Fetch relative images referenced by the document from the same commit, and cache them locally for the session.
- v1 assumes the PR adds a new document. Do not handle modified-file diffs.

AC:
- Unit tests cover URL parsing (both URL forms, malformed URLs) and change filtering against recorded API fixtures.
- UI tests cover the zero, one, and many file cases using a mocked ADO API (do not call the real API in tests).
- 401/403/404 from ADO produce specific user-facing messages (bad token, no access, PR not found).

### FR3. Markdown rendering

- Render a clean, readable view in a sans-serif font (system UI stack is fine, or bundle Inter locally; no external CDN calls).
- Support CommonMark, GFM (tables, task lists, strikethrough, autolinks, footnotes), front matter (hidden from view, shown in a metadata panel), and fenced code with syntax highlighting (Shiki or highlight.js, bundled locally).
- Diagram code blocks: render Mermaid and D2 as diagrams. arc42 documents frequently use them. Treat this as a milestone 5 item. See FR3a.
- Raw HTML is allowed but sanitised.
- **Resilience rule:** rendering must never fail to show content. If a node fails to render, fall back to showing that node's raw source in a `<pre>` with a warning style, and continue. If the whole parse fails, show the raw text in a `<pre>` and mark diagnostics red. Wrap each stage in error handling that degrades rather than throws.

### FR3a. Diagram rendering (Mermaid and D2)

Detection:
- Fenced code blocks with info string `mermaid` render with Mermaid.
- Fenced code blocks with info string `d2` render with D2.
- Design the renderer as a small plugin interface (`DiagramRenderer { lang, render(source, theme) }`) so PlantUML or others can be added later without touching the pipeline.

Mermaid:
- Render client-side with the `mermaid` package, bundled locally.
- Re-render on theme toggle using Mermaid's `default` and `dark` themes.

D2:
- Render server-side in Node with the official `@terrastruct/d2` package (D2.js, the WASM build of D2). It runs in both Node and the browser, so no Go binary or `d2` CLI is required.
- Rendering on the server lets compile errors flow straight into the diagnostics list with line numbers, and keeps the WASM load off the presentation browser.
- Cache rendered SVG keyed by `sha256(source + theme + layout)` so reloads and theme toggles are instant.
- Render a light variant (theme 0) and a dark variant (a dark theme such as 200), and swap on theme toggle. Make both theme IDs configurable.
- Default layout engine: `dagre`. Allow `elk` via config. **Flag:** D2's TALA layout engine is proprietary and not part of D2.js. If a document requests `layout-engine: tala` in its D2 vars, fall back to the default and log a warning.
- The D2.js package is pre-1.0. Pin the exact version and note it in the README.
- Ensure the WASM file is bundled and served locally. No CDN.
- Sanitise the generated SVG (strip scripts and event handlers) before inlining.

Both:
- On a render failure (syntax error, timeout, library failed to load), show the diagram source as a highlighted code block with a small "Diagram failed to render" notice, and add a warning to diagnostics with the error message and line. Never block the rest of the document.
- Apply a render timeout (default 5 seconds per diagram) so a pathological diagram cannot hang the app.
- Diagrams scale with the presentation zoom and fit the reading width, with click-to-expand for large diagrams.
- A "Show source" toggle per diagram reveals the D2 or Mermaid source, which is useful when reviewers comment on diagram content.

Feedback on diagrams:
- Diagram SVG text is not part of the selectable text model, and is excluded from offset calculations.
- On hover, each diagram shows a small "Add feedback on this diagram" button. This creates range feedback anchored to the whole diagram block: `quote_exact` holds the diagram source, `section_heading` the containing section, and offsets cover the block. The margin marker and panel behave as for text ranges, and the diagram gets a status-coloured outline instead of a text highlight.
- A text selection that starts or ends inside a diagram snaps to the whole diagram block, subject to the same one-section limit.

AC:
- Valid Mermaid and D2 fixtures render as SVG in both themes.
- Invalid Mermaid and D2 fixtures show source plus notice, and the diagnostics indicator turns orange with the error line.
- A D2 fixture requesting TALA renders with the fallback layout and a warning.
- Diagram feedback round-trips through CSV export and import and re-anchors correctly.
- No network requests are made during diagram rendering (assert in Playwright).

### FR4. Diagnostics indicator

- A small, unobtrusive indicator (for example a dot in the header):
  - Green: no issues
  - Orange: warnings (lint issues, missing images, unknown link targets, heading level skips, unclosed fences that were auto-closed)
  - Red: read failures or render failures (fallbacks used)
- Clicking it opens a panel listing each issue with severity, line number, and message. Clicking an issue scrolls to the corresponding location in the document where possible.
- The indicator must not distract on a shared screen. Keep it small and muted.

AC:
- Fixture documents exist for each state and UI tests assert the indicator colour and the issue count.

### FR5. Participants

- Load a participant list from a file (support CSV and JSON). Fields: `name` (required), `email` (optional), `role` (`author` or `reviewer`, default `reviewer`).
- Exactly one author is expected. Zero or multiple authors is a warning, not an error.
- Participants can also be added manually in the UI during the meeting.
- The participant list is stored per document review session.

AC:
- Invalid files (missing name column, empty file, malformed JSON, duplicate names) produce clear errors listing the offending rows.

### FR6. Feedback model

Statuses (exactly these three): `Reject`, `Accept with conditions`, `Accept`.

Every feedback item records:
- `id` (UUID)
- `scope`: `document` or `range`
- `status`
- `comment` (free text, required for `Reject` and `Accept with conditions`, optional for `Accept`)
- `reviewer` (a participant, which is not necessarily the facilitator)
- `created_at` (ISO 8601 with timezone offset)
- `updated_at`
- For `range` scope: the anchor (see FR8)

Feedback items can be edited and deleted. Deletion asks for confirmation.

The reviewer selector defaults to the last reviewer used, so the facilitator can capture a run of comments from one person quickly.

### FR7. Whole-document feedback

- A clearly labelled control opens a form: reviewer, status, comment.
- A "Document feedback" panel lists all whole-document items with status, reviewer, date, and comment. Sort by date, filterable by status and reviewer.
- Show a compact summary near the indicator, for example counts by status.

### FR8. Targeted (range) feedback

**Creating:**
- The user selects text with the mouse. A small floating "Add feedback" button appears near the selection.
- Clicking it opens the form (reviewer, status, comment) with the selected text quoted at the top.

**Selection limit:**
- A section is defined as an H2 heading and everything up to the next H2 (so H3 subsections belong to their parent H2). Make the section heading level configurable, default 2.
- A selection may cover at most one entire section. A selection whose start and end fall in different sections is not allowed.
- When an invalid selection is made, do not show the "Add feedback" button. Instead show an inline message near the selection, for example: "Feedback can cover at most one section. This selection spans '3. Context and Scope' and '4. Solution Strategy'." Dismiss it on the next click or selection.
- Selections that include the section heading itself are allowed.
- Collapsed (empty) and whitespace-only selections are ignored.
- Selections that begin or end inside the app chrome (panels, header) are ignored.

**Anchoring:**
Store anchors so they survive re-rendering and can be re-attached after import. Use a W3C Web Annotation style combined selector:
- `start_offset` / `end_offset`: character offsets into the normalised rendered text of the document
- `quote_exact`: the selected text
- `quote_prefix` / `quote_suffix`: up to 32 characters either side
- `section_heading`: text of the containing section heading (for humans reading the CSV)

On re-attach, try offsets first and verify against `quote_exact`. If that fails, search by quote with prefix/suffix context. If that fails, mark the item as **orphaned**: keep it, list it in the feedback panel under "Could not locate in document", and add a warning to diagnostics.

AC:
- Unit tests for offset mapping across inline formatting (bold, links, code spans), list items, table cells, and across block boundaries within one section.
- Unit tests for section-boundary validation, including a selection that exactly covers one section (allowed), one that runs one character into the next section (rejected), and one inside nested H3s (allowed).
- Unit tests for re-anchoring when offsets are stale but the quote is unique, when the quote is ambiguous (prefix/suffix disambiguates), and when the quote is missing (orphaned).

### FR9. Viewing range feedback

- Each range with feedback has a subtle visual indicator: a light background tint plus a thin underline, coloured by status (Reject, Accept with conditions, Accept). Colours must work in both themes and meet WCAG AA contrast against body text. Do not rely on colour alone: also show a small margin marker per block containing feedback, with a count.
- **Overlaps:** where ranges overlap, the tint deepens (stacked highlights) so overlap is visible. When ranges with different statuses overlap, the most severe status determines the underline colour (Reject > Accept with conditions > Accept).
- Hovering a highlighted range shows a tooltip summary. Clicking it opens a side panel listing **every** feedback item covering that point, each with reviewer, status, date, comment, and the quoted text. Clicking an item in the panel briefly emphasises its exact range.
- Clicking a margin marker opens the same panel for all items in that block.
- A toggle hides all highlights (useful when reading the document aloud on screen).
- An "All feedback" panel lists every item (document and range), filterable and sortable. Clicking a range item scrolls to and emphasises it.

### FR10. Export to CSV

- One CSV file containing both document and range feedback.
- UTF-8 with BOM (Excel compatibility), RFC 4180 quoting, header row.
- Columns, in this order:

```
id, document_name, document_sha256, scope, status, reviewer, reviewer_role, created_at, updated_at, comment, section_heading, start_offset, end_offset, quote_exact, quote_prefix, quote_suffix
```

- Range-only columns are empty for document-scope rows.
- Filename default: `<document-name>-feedback-<yyyymmdd-hhmm>.csv`.
- Comments may contain commas, quotes, newlines, and non-ASCII text. These must round-trip exactly.

### FR11. Import from CSV

- Accept a CSV in the export format.
- Before importing, show a confirmation dialog with:
  - Row count, counts by scope and status
  - Choice: **Replace** (clear all existing feedback, then import) or **Merge** (add to existing)
  - A warning if `document_sha256` does not match the loaded document (feedback may not anchor correctly)
- Merge rules: rows whose `id` already exists are skipped and reported as duplicates (do not overwrite).
- Reviewers not in the participant list are added automatically and reported.
- Validation is per row. Invalid rows are skipped and listed in an import report (row number, reason). Valid rows still import. If every row is invalid, import nothing.
- Validate: required columns present (header check, order independent), `scope` and `status` values from the allowed set, `created_at` parses as a date, range rows have offsets and `quote_exact`, `end_offset > start_offset`.
- After import, run re-anchoring (FR8). Orphaned items are reported.
- Replace is destructive. Before replacing, write an automatic backup export to the app's data directory and mention it in the report.

### FR12. Navigation and viewing

| Key | Action |
|---|---|
| PageUp / PageDown | Scroll by one viewport (minus a small overlap) |
| Home / End | Go to start / end of the document |
| Ctrl+Up / Ctrl+Down | Previous / next section heading (any heading level, configurable) |
| Mouse wheel | Normal scroll |

- Keyboard shortcuts must not fire while focus is in a text input, textarea, or select.
- Provide on-screen previous/next section buttons too.
- **Flag:** on macOS, Ctrl+Up and Ctrl+Down are captured by Mission Control by default. Also bind Alt+Up / Alt+Down and document this in the README.
- Show a sticky header or breadcrumb with the current section title so remote viewers know where the discussion is.

### FR13. Presentation on a shared screen

- Light and dark themes, following the OS preference by default, with a manual toggle that persists.
- A presentation zoom control (for example 100% to 200%) that scales the document text, not the side panels. Persist it.
- A comfortable reading width (around 70 to 80 characters) centred on screen, with panels sliding over or beside it.
- Respect `prefers-reduced-motion`.

### FR14. Sessions and persistence

- Each loaded document creates or resumes a review session keyed by document source (path or PR + file) and content hash.
- If a document is reloaded and its hash has changed, warn the user and run re-anchoring.
- All feedback and participants persist in SQLite in a per-user data directory. Restarting the app must lose nothing.

---

## Non-functional requirements

- Bind to `127.0.0.1` by default. Make the port configurable. Do not expose on the LAN unless an explicit flag is set.
- No external network calls at runtime other than Azure DevOps. Bundle all fonts, scripts, and styles.
- Sanitise all rendered HTML. Escape all user-entered text (comments, names) on output.
- Keep CSV injection in mind: prefix cells starting with `=`, `+`, `-`, `@` with a single quote on export, and strip that prefix on import.
- A 2,000-line arc42 document with 200 feedback items should render and highlight in under 1 second on a typical laptop. Add a performance test for this.
- Start with one command: `npm start`. Development mode with reload: `npm run dev`.

---

## Testing

### Unit tests (Vitest)
At minimum:
- Markdown pipeline: each fixture renders without throwing, diagnostics severity is correct, fallbacks trigger for broken nodes
- Section model: heading extraction, section boundaries, configurable level
- Offset mapping and selection validation (see FR8 ACs)
- Re-anchoring (see FR8 ACs)
- CSV export and import: round-trip, special characters, BOM, CSV injection handling, each validation rule, merge duplicate handling, replace with backup
- Participant file parsing (valid and invalid)
- ADO URL parsing and change filtering (with fixtures)
- Image path resolution and traversal rejection
- Diagram renderer: fence detection, D2 cache keying, timeout handling, SVG sanitisation, error-to-diagnostic mapping

### UI tests (Playwright)
Cover both valid and invalid inputs. At minimum:

Valid:
- Load local doc, verify render and green indicator
- Load PR with one md file, with multiple (picker shown), with mocked ADO
- Mermaid and D2 diagrams render, swap on theme toggle, and accept diagram feedback
- Add whole-document feedback for each status
- Select text within a section and add range feedback, verify highlight appears
- Create two overlapping ranges, click the overlap, verify both appear in the panel
- Edit and delete feedback
- Export, then import with Replace, then with Merge, verify counts and duplicate report
- Keyboard navigation: PageDown, Home, End, Ctrl+Down, Ctrl+Up land at the expected positions
- Theme toggle and zoom persist across reload

Invalid:
- Missing file path, non-markdown file, malformed markdown (indicator orange or red, content still shown)
- Missing image (placeholder shown, warning listed)
- Malformed Mermaid and D2 blocks (source shown, warning listed, rest of document unaffected)
- Selection spanning two sections (button not shown, message shown with both section names)
- Empty comment on Reject (validation error)
- Malformed participant file
- CSV with missing columns, bad status values, bad dates, partially valid rows (report lists skipped rows), document hash mismatch warning
- ADO 401, 404, and PR with zero added md files
- Keyboard shortcuts do not fire while typing a comment

Run UI tests in both light and dark themes for at least the highlight tests. Include fixture documents under `test/fixtures/` modelled on arc42, including deliberately malformed ones.

---

## Milestones

1. **Skeleton:** Hono server, layout, theme toggle, local file load, remark pipeline with source positions, image serving, diagnostics indicator. Unit tests for pipeline and path safety.
2. **Navigation and presentation:** keyboard handling, section model, sticky section header, zoom. UI tests for navigation.
3. **Range feedback:** selection capture, section validation, anchoring, Custom Highlight API rendering with overlap handling, feedback panel. Participants. SQLite persistence.
4. **Document feedback, export, import:** full CSV round-trip, replace/merge, re-anchoring, orphan handling.
5. **Azure DevOps loading, Mermaid and D2 diagrams, polish:** PR loading with mocked tests, performance test, README.

---

## Deliverables

- Source in a single repository with `README.md` covering install, run, configuration (`ADO_PAT`, port, section level, data directory), supported browsers, keyboard shortcuts, and the CSV format.
- `docs/PLAN.md` with architecture and assumptions.
- `docs/CSV_FORMAT.md` with the column specification and an example file.
- Sample participant file and sample arc42 document under `examples/`. The sample document must include at least one Mermaid and one D2 diagram.
- All tests passing via `npm test` (unit) and `npm run test:e2e` (Playwright).

---

## Assumptions (confirm or override in PLAN.md)

1. One facilitator operates the app. There is no real-time multi-user collaboration in v1.
2. "Section" means an H2 and its subsections, configurable.
3. The author can also be recorded as giving feedback (for example, acknowledging an issue). This is allowed but the role is captured in the export.
4. Comments are required for Reject and Accept with conditions, optional for Accept.
5. Feedback is tied to the document content hash. A changed document triggers re-anchoring, not a new empty session.
6. Only added `.md` files are considered in a PR. Modified files are out of scope.
7. No authentication on the local app itself, since it binds to localhost.
