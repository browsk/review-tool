# Traceability: requirements to milestones and tests

Updated at the end of each milestone. "U" = Vitest (`test/unit`), "E" = Playwright (`test/e2e`), "P" = perf project.

| Requirement / acceptance criterion | Milestone | Tests |
|---|---|---|
| FR1 valid doc renders, green indicator | M1 | E m1 "loads a valid document"; U app |
| FR1 non-existent path: error, previous document kept | M1 | E m1 "missing path..."; U app |
| FR1 non-markdown / binary: red indicator + read failure entry | M1 | E m1 "binary and non-markdown..."; U app, paths |
| FR1 `../../etc/passwd` not served; encoded, absolute, UNC, drive, ADS, symlink, sibling-prefix | M1 | U paths (13 cases); E m1 "traversal image requests..." |
| FR1 missing image placeholder + diagnostics warning | M1 | U pipeline; E m1 "warnings give an orange indicator..." |
| FR1 recent documents list | M1 | (manual) `recent.json`; no automated test yet |
| FR2 URL parsing: dev.azure.com and legacy visualstudio.com forms, encoded names, DefaultCollection, trailing slash/query/fragment; malformed and hostile URLs | M5a | U ado (22 URL cases) |
| FR2 change filtering: only added .md (flags like "add, edit"), not edit/rename/delete/folders/other types; pagination; latest iteration's source commit | M5a | U ado (against mock fixtures); E m5a |
| FR2 zero / one / many files: message, direct load, picker | M5a | U ado-app; E m5a (mocked API) |
| FR2 401 / 403 / 404 (and 203 sign-in page, 500, timeout, network) give specific messages | M5a | U ado, ado-app; E m5a |
| FR2 images fetched from the same commit, cached locally, traversal/unsafe paths refused | M5a | U ado (cache + safeRelImage); E m5a |
| FR2 PAT from ADO_PAT or UI; never persisted (database, cache, recent list, exports) or echoed | M5a | U ado-app (scans the whole data dir); E m5a |
| FR3 CommonMark/GFM/front matter/code highlighting | M1 | U pipeline |
| FR3 raw HTML sanitised | M1 | U pipeline (xss fixture) |
| FR3 resilience (node fallback, whole-parse fallback) | M1 | U pipeline ("never throws...") |
| FR3a fence detection; Mermaid (client, bundled, lazy) and D2 (server, WASM, pinned 0.1.33) render as SVG in both themes; plugin interface | M5b | U diagrams (registry, D2 service), pipeline-diagrams; E m5b "rendering" |
| FR3a D2: cache keyed by sha256(source+theme+layout+version+theme ids); timeout kills the worker and recovers; SVG sanitised; TALA -> dagre + warning; source-size cap | M5b | U diagrams (real D2.js); E m5b TALA test |
| FR3a failures: source shown + notice, orange indicator with the error line, document unaffected (Mermaid and D2) | M5b | U pipeline-diagrams; E m5b "failures degrade gracefully" |
| FR3a zoom scaling, click-to-expand, Show source, no network requests | M5b | E m5b (zoom, expand, source toggle; every spec asserts no external requests) |
| FR3a feedback on diagrams: hover button, whole-block anchor (quote = source), outline + marker + panel; selection snapping and one-section limit | M5b | E m5b "feedback on diagrams"; U textmodel (snapping) |
| FR3a diagram feedback round-trips through CSV and re-anchors by source | M5b | U anchor (reanchorDiagram), csv (inferKind); E m5b round-trip test |
| FR4 indicator green/orange/red + panel, jump to location | M1, M3 | E m1; U app; E m3 re-anchoring (client diagnostics) |
| FR5 participants: file CSV/JSON, manual add | M3 | U participants; U api; E m3 "participants" |
| FR5 invalid files list offending rows (missing column, empty, malformed JSON, duplicates) | M3 | U participants; E m3 "malformed participant file..." |
| FR5 author-count warning | M3 | E m3 "add manually, import a CSV..." |
| FR6 statuses, comment rules, edit, delete with confirmation | M3 | U api (validation); E m3 "empty comment...", "edit and delete..." |
| FR6 reviewer defaults to last reviewer | M3 | E m3 "reviewer defaults..."; U api (lastReviewerId) |
| FR7 whole-document feedback form, panel (date sort, status/reviewer filters), summary counts near the indicator | M4 | E m4 "whole-document feedback" (2 tests); U api |
| FR8 select text, floating button, quoted form | M3 | E m3 "select text in a section...", "a real mouse drag..." |
| FR8 one-section limit + message naming both sections; dismiss on next click | M3 | U sectionrules; E m3 "a selection across two sections..." |
| FR8 collapsed / whitespace-only / chrome selections ignored | M3 | E m3 "collapsed, whitespace-only and chrome..." |
| FR8 offset mapping: inline formatting, lists, tables, block boundaries | M3 | U textmodel |
| FR8 section validation: exact section, one char over, nested H3 | M3 | U sectionrules; E m3 "...H3 subsections..." |
| FR8 re-anchoring: stale offsets, ambiguous quote, missing quote (orphan) | M3 | U anchor; E m3 "re-anchoring after the document changes" |
| FR9 highlights: tint + underline per status, AA contrast both themes, margin marker with count | M3 | U palette; E m3 pixel tests (light and dark); E m3 overlap test |
| FR9 overlap deepens; most severe wins; click lists every item | M3 | U layers; E m3 overlap + pixel tests; E xbrowser |
| FR9 tooltip, panel item emphasises range, hide toggle, All feedback panel with filters/sort | M3 | E m3 (tooltip, flash, toggle, filters) |
| FR10 one CSV: BOM, RFC 4180, column order, empty range columns for document rows, filename, exact round-trip of commas/quotes/newlines/non-ASCII | M4 | U csv (export, round-trip, property-style); U api (export endpoint); E m4 "CSV export" |
| FR11 import: confirmation dialog (counts, Replace/Merge, hash warning), merge duplicates, new reviewers, per-row validation + report, all-invalid imports nothing, Replace backup, re-anchoring + orphans | M4 | U csv (every rule); U api (preview/commit, backup, conflicts, atomic abort); E m4 "CSV import" (7 tests) |
| FR12 PageUp/PageDown/Home/End, Ctrl/Alt+Up/Down, buttons, breadcrumb | M2 | U navlogic; E m2 |
| FR12 shortcuts do not fire while typing | M2, M3 | U navlogic; E m2 (path input); E m3 (comment box) |
| FR13 themes follow OS + toggle persists; zoom persists; reading width; reduced motion | M1, M2 | E m1 (theme); E m2 (zoom, width, reduced motion) |
| FR14 sessions persist across restart | M3 | U api ("keeps feedback and participants across an app restart") |
| FR14 changed hash: warn, re-anchor, resume session | M3 | U api; E m3 re-anchoring |
| NFR localhost binding, Host/Origin/token checks, CSP | M1 | U app; E m1 |
| NFR no external requests | M1+ | E global fixture (every spec); xbrowser/perf use the same origin only |
| NFR CSV injection guard (all text cells; lossless strip on import) | M4 | U csv (each leading character, double prefix, all text columns, randomised round-trip); E m4 export test |
| NFR 2,000 lines + 200 items under 1 s (measured: page ready ~400 ms, client init ~120 ms) | M3 (early), M5 (final) | P perf (
pm run test:perf) |
| Deliverable docs/CSV_FORMAT.md + example file | M4 | U example-csv (keeps the documented example valid and the documented messages accurate) |
| Deliverables: README (install, run, configuration, browsers, shortcuts, CSV), sample arc42 with Mermaid and D2, participant files, example CSV | M5 | U examples (sample renders warning-free with diagrams; participant files valid; large sample valid) |
| 
pm start, 
pm run dev (live reload verified), 
pm test, 
pm run test:e2e, 
pm run test:perf | M1-M5 | scripts in package.json |
| Loaders collapse once a document is displayed (more screen for the document) | M5 | E m1 |
| Participant role changed in place; friendly author warning | M4 | E m4 "participants: roles and author warning"; U api |
