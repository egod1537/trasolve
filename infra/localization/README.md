# Localization synchronization

This utility reads localization namespaces from a Google Spreadsheet and writes
deterministic JSON snapshots for the frontend. It is an infrastructure command;
the browser and production build never contact Google Sheets.

## Spreadsheet

The default spreadsheet is `localization`. Its ID is the repository constant
`LOCALIZATION_SPREADSHEET_ID` in `infra/localization/opts.ts`.

To open a configured sheet, derive its URL as
`https://docs.google.com/spreadsheets/d/<spreadsheet-id>/edit`; the full URL is
not stored as configuration.

Set the `LOCALIZATION_SPREADSHEET_ID` environment variable only when reading a
different spreadsheet.

Each Google Sheet tab is a namespace. For example, the `map` tab row with
`loc_key` `search.placeholder` produces the logical key
`map:search.placeholder` and writes it below `map.json`.

Tabs are discovered dynamically. A tab participates when its header looks like
localization data and contains the complete standard schema. Empty tabs and
clearly unrelated administrative tabs are ignored. A localization-looking tab
with malformed headers fails the sync instead of being silently skipped.

## Authentication

1. Create a Google Cloud service account in a project with the Google Sheets API
   enabled.
2. Share the spreadsheet with the service account's `client_email` as a Viewer.
3. Put the full service-account JSON on one line in
   `GOOGLE_SERVICE_ACCOUNT_JSON`.

The command reads environment variables from the current process. It also loads
the ignored root `.env.local` file when present. See the fake values in
`.env.example` for the expected shape.

Never commit a service-account key file, a real JSON credential, an API token,
or a populated `.env.local` file.

## Sheet schema

Every localization tab uses these headers:

| loc_key            | ko                | ja                     | en                 | context           | status   |
| ------------------ | ----------------- | ---------------------- | ------------------ | ----------------- | -------- |
| search.placeholder | 장소를 검색하세요 | 場所を検索してください | Search for a place | Search input hint | REVIEWED |

- `loc_key` is local to the tab namespace and uses dot-separated identifier
  segments. Do not repeat the namespace in it.
- `context` and `status` are translator metadata and are never emitted.
- Rows are exported regardless of `status` (`TODO`, `TRANSLATED`, and
  `REVIEWED` are treated alike).
- An empty translation is emitted as an empty string. This keeps all locale key
  structures aligned and makes missing work visible in Git diffs.

## Output modes

The default command writes local-only resources for development and quick
verification:

```sh
npm run localization:sync
```

```text
frontend/src/shared/i18n/generated-local/
  ko/<namespace>.json
  ja/<namespace>.json
  en/<namespace>.json
```

`generated-local/` is ignored by Git. Do not import it as a production build
dependency or commit its contents.

Use production mode when updating the version-controlled resource snapshot:

```sh
npm run localization:sync -- --production
```

Production resources are written to:

```text
frontend/src/shared/i18n/resources/
  ko/<namespace>.json
  ja/<namespace>.json
  en/<namespace>.json
```

Both modes read the same configured spreadsheet and run the same validation and
generation pipeline. The resulting locale structure is identical; only the
output root differs. Files use UTF-8, two-space indentation, deterministic key
ordering, and a trailing newline.

Commit files generated in production mode to Git. Within the selected output
root, the sync command owns all `.json` files in the `ko`, `ja`, and `en`
directories and removes stale namespace files after all spreadsheet data has
passed validation.

## Validation

The command fails before writing resources when it encounters:

- a populated row without `loc_key`;
- duplicate or malformed keys;
- nested collisions such as `foo` and `foo.bar`;
- missing, duplicate, or unexpected localization headers;
- an unsafe namespace filename;
- sheet names that normalize to the same case-insensitive output filename; or
- a generated path that would escape its locale directory.

Completely empty rows are ignored. Unicode translation values are preserved
exactly as returned by Google Sheets.
