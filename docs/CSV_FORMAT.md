# Feedback CSV format

The app exports all feedback for a document (whole-document and range) as one CSV file, and imports files in the
same format. A worked example is in [`examples/feedback-example.csv`](../examples/feedback-example.csv).

## File format

- UTF-8 with a byte-order mark (so Excel opens it with the right encoding). The importer accepts files with or
  without the BOM.
- RFC 4180: comma delimiter, fields containing commas, double quotes or line breaks are wrapped in double quotes,
  and a double quote inside a field is doubled (`""`). Records end with CRLF; the importer accepts CRLF or LF.
- One header row. **Export** always writes the columns below in this order. **Import** matches columns by name
  (case-insensitive), in any order, and ignores columns it does not know.
- Comments and quotes may contain commas, quotes, line breaks and any Unicode text, and round-trip exactly
  (leading and trailing spaces are kept).
- Default filename: `<document-name>-feedback-<yyyymmdd-hhmm>.csv` (local time; characters that are illegal in
  file names are replaced by `_`).

## Columns

| # | Column | Export | Import | Meaning |
|---|---|---|---|---|
| 1 | `id` | always | **required** | Feedback id, a UUID. Ids make Merge safe: an id that already exists is skipped. |
| 2 | `document_name` | always | optional | File name of the document without the extension. Informational. |
| 3 | `document_sha256` | always | optional | SHA-256 of the document source the feedback was captured against. If it differs from the loaded document the import dialog warns and anchors are re-attached by quote. |
| 4 | `scope` | always | **required** | `document` (whole document) or `range` (selected text or diagram). |
| 5 | `status` | always | **required** | Exactly `Reject`, `Accept with conditions` or `Accept`. |
| 6 | `reviewer` | always | **required** | Participant name. Matched to existing participants case-insensitively; unknown names are added. |
| 7 | `reviewer_role` | always | optional | `author` or `reviewer` (default `reviewer`). Used only when a new participant is created. |
| 8 | `created_at` | always | **required** | ISO 8601 with time zone offset and milliseconds, e.g. `2026-11-18T10:05:37.118+10:00`. A date alone or `Z` is accepted on import. Preserved on import. |
| 9 | `updated_at` | always | optional | Same format; defaults to `created_at`. |
| 10 | `comment` | always | **required** (may be empty) | Free text. Required (non-blank) for `Reject` and `Accept with conditions`; optional for `Accept`. |
| 11 | `section_heading` | always | optional | Text of the heading of the containing section, for people reading the file. Empty for `document` rows. |
| 12 | `start_offset` | always | **required** (may be empty for `document`) | Range rows: start of the selection as a character offset (UTF-16 code units) into the normalised rendered text (see below). Empty for `document` rows. |
| 13 | `end_offset` | always | **required** (may be empty for `document`) | Range rows: end offset, exclusive. Must be greater than `start_offset`. |
| 14 | `quote_exact` | always | **required** (may be empty for `document`) | Range rows: the selected text. This is the real anchor: offsets are only a hint. |
| 15 | `quote_prefix` | always | optional | Up to 32 characters of text before the selection, used to pick the right occurrence when the quote appears more than once. |
| 16 | `quote_suffix` | always | optional | Up to 32 characters of text after the selection. |

For `document` rows the range columns (11-16) are empty on export and ignored on import.

### Offsets and the text model

Offsets index into the text of the rendered document as the app normalises it (text model version 1): the text of
every text node in order, whitespace collapsed to single spaces (preformatted code kept verbatim), one newline
between blocks, table cells separated by a space, and a single `U+FFFC` placeholder character for a diagram
block. App chrome and diagram SVG text are excluded. Because the algorithm may change in a future version, treat
`quote_exact` + `quote_prefix` + `quote_suffix` as authoritative.

When feedback is loaded the app first checks that the stored offsets still select exactly `quote_exact`. If not it
searches for the quote (using prefix and suffix to choose between several matches, then the match nearest the old
offset). If the quote cannot be found the item is kept and listed under **Could not locate in document**, with a
warning in the diagnostics panel.

## CSV injection guard

Spreadsheets treat a cell that starts with `=`, `+`, `-`, `@`, a tab or a carriage return as a formula. On export
every **text** cell that starts with one of those characters gets a leading apostrophe (`'`). A cell that already
starts with one or more apostrophes followed by such a character gets one more, so the original value is always
recoverable. On import exactly one leading apostrophe is removed from cells that match that pattern. An ordinary
leading apostrophe (`'tis`) is left alone. Numeric offsets are never altered.

| Original value | In the CSV file | After import |
|---|---|---|
| `=SUM(A1)` | `'=SUM(A1)` | `=SUM(A1)` |
| `-5` | `'-5` | `-5` |
| `'=x` | `''=x` | `'=x` |
| `'tis` | `'tis` | `'tis` |

## Import

1. Choose the file under **Feedback > Import CSV...**. Nothing changes yet: the app validates the file and shows a
   confirmation dialog with the row count, counts by scope and status, a warning if `document_sha256` does not
   match the loaded document, the participants that would be added, and the list of rows that will be skipped.
2. Choose **Merge** (default) or **Replace**, then **Import**.
   - **Merge** adds the valid rows. Rows whose `id` already exists are skipped and reported as duplicates; existing
     items are never overwritten.
   - **Replace** deletes all existing feedback for this document, then imports. Before anything is deleted an
     automatic backup export of the existing feedback is written to `<data dir>/backups/` (the 20 most recent are
     kept) and its path is shown in the report. If the backup cannot be written nothing is changed. Participants are
     not removed.
3. The import runs in one database transaction. Afterwards every imported range item is re-anchored; items that
   cannot be located are reported.

### Validation

Validation is per row. Invalid rows are skipped and listed in the report with their row number (the header is row
1) and every reason; valid rows still import. If **every** row is invalid nothing is imported: no backup is made
and nothing is deleted.

The whole file is rejected (with a message) when it is empty, unreadable as CSV, has no data rows, is larger than
10 MB or has more than 50,000 rows, or lacks a required column (the message names the missing columns).

| Rule | Reason shown when broken |
|---|---|
| `id` is present, a UUID, and unique within the file (first occurrence wins) | `id is empty` / `... is not a UUID` / `duplicate id (first seen on row N)` |
| `scope` is `document` or `range` | `scope "x" must be document or range` |
| `status` is one of the three statuses | `status "x" must be Reject, Accept with conditions, or Accept` |
| `reviewer` is not empty | `reviewer is empty` |
| `reviewer_role`, if present, is `author` or `reviewer` | `reviewer_role "x" must be author or reviewer` |
| `comment` is not blank for `Reject` and `Accept with conditions` | `comment is required for "Reject"` |
| `created_at` (and `updated_at` if present) is an ISO 8601 date | `created_at "x" is not a valid ISO 8601 date` |
| Range rows: `start_offset` and `end_offset` are non-negative integers | `start_offset must be a non-negative integer` |
| Range rows: `end_offset > start_offset` | `end_offset must be greater than start_offset` |
| Range rows: `quote_exact` is not empty | `quote_exact is required for range feedback` |

An `id` that is already used by a different document's review is reported as a conflict and skipped.

An imported range item that, after re-anchoring, spans more than one section is kept and flagged in the
diagnostics panel (the one-section limit applies when creating feedback, not when importing it).

## Example

```csv
id,document_name,document_sha256,scope,status,reviewer,reviewer_role,created_at,updated_at,comment,section_heading,start_offset,end_offset,quote_exact,quote_prefix,quote_suffix
3f6a1c52-...,payments-arc42,9b1d6f0c...,document,Accept with conditions,Grace Hopper,reviewer,2026-11-18T10:02:11.402+10:00,2026-11-18T10:02:11.402+10:00,Good overall. Please address the section comments before the next review.,,,,,,
7c0e9d84-...,payments-arc42,9b1d6f0c...,range,Reject,Alan Turing,reviewer,2026-11-18T10:05:37.118+10:00,2026-11-18T10:06:02.640+10:00,"The target of ""99.99% availability"" is not backed by a measurement.
Where does the number come from?",3. Context and Scope,1204,1262,The platform must be available 99.99% of the time.,"the payment gateway. ",Availability is measured monthly.
```

(The ids and hash are shortened here; the full file is `examples/feedback-example.csv`. Its third row shows the
injection guard: the comment `=Acknowledged - will add a runbook link` is stored as `'=Acknowledged ...`.)
