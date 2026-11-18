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
| FR2 Azure DevOps loading | M5a | pending |
| FR3 CommonMark/GFM/front matter/code highlighting | M1 | U pipeline |
| FR3 raw HTML sanitised | M1 | U pipeline (xss fixture) |
| FR3 resilience (node fallback, whole-parse fallback) | M1 | U pipeline ("never throws...") |
| FR3a diagrams (Mermaid, D2), feedback on diagrams | M5b | pending (text model/selection snapping done in M3: U textmodel) |
| FR4 indicator green/orange/red + panel, jump to location | M1, M3 | E m1; U app; E m3 re-anchoring (client diagnostics) |
| FR5 participants: file CSV/JSON, manual add | M3 | U participants; U api; E m3 "participants" |
| FR5 invalid files list offending rows (missing column, empty, malformed JSON, duplicates) | M3 | U participants; E m3 "malformed participant file..." |
| FR5 author-count warning | M3 | E m3 "add manually, import a CSV..." |
| FR6 statuses, comment rules, edit, delete with confirmation | M3 | U api (validation); E m3 "empty comment...", "edit and delete..." |
| FR6 reviewer defaults to last reviewer | M3 | E m3 "reviewer defaults..."; U api (lastReviewerId) |
| FR7 whole-document feedback UI, summary | M4 | pending (API tested in M3: U api) |
| FR8 select text, floating button, quoted form | M3 | E m3 "select text in a section...", "a real mouse drag..." |
| FR8 one-section limit + message naming both sections; dismiss on next click | M3 | U sectionrules; E m3 "a selection across two sections..." |
| FR8 collapsed / whitespace-only / chrome selections ignored | M3 | E m3 "collapsed, whitespace-only and chrome..." |
| FR8 offset mapping: inline formatting, lists, tables, block boundaries | M3 | U textmodel |
| FR8 section validation: exact section, one char over, nested H3 | M3 | U sectionrules; E m3 "...H3 subsections..." |
| FR8 re-anchoring: stale offsets, ambiguous quote, missing quote (orphan) | M3 | U anchor; E m3 "re-anchoring after the document changes" |
| FR9 highlights: tint + underline per status, AA contrast both themes, margin marker with count | M3 | U palette; E m3 pixel tests (light and dark); E m3 overlap test |
| FR9 overlap deepens; most severe wins; click lists every item | M3 | U layers; E m3 overlap + pixel tests; E xbrowser |
| FR9 tooltip, panel item emphasises range, hide toggle, All feedback panel with filters/sort | M3 | E m3 (tooltip, flash, toggle, filters) |
| FR10 CSV export | M4 | pending |
| FR11 CSV import (validation, merge/replace, backup, report) | M4 | pending |
| FR12 PageUp/PageDown/Home/End, Ctrl/Alt+Up/Down, buttons, breadcrumb | M2 | U navlogic; E m2 |
| FR12 shortcuts do not fire while typing | M2, M3 | U navlogic; E m2 (path input); E m3 (comment box) |
| FR13 themes follow OS + toggle persists; zoom persists; reading width; reduced motion | M1, M2 | E m1 (theme); E m2 (zoom, width, reduced motion) |
| FR14 sessions persist across restart | M3 | U api ("keeps feedback and participants across an app restart") |
| FR14 changed hash: warn, re-anchor, resume session | M3 | U api; E m3 re-anchoring |
| NFR localhost binding, Host/Origin/token checks, CSP | M1 | U app; E m1 |
| NFR no external requests | M1+ | E global fixture (every spec); xbrowser/perf use the same origin only |
| NFR CSV injection guard | M4 | pending |
| NFR 2,000 lines + 200 items under 1 s | M3 (early), M5 (final) | P perf |
| Deliverables: README, CSV_FORMAT.md, examples | M4, M5 | pending |
