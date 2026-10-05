# Local analytics NDJSON storage

When `resolveBackendPersistenceMode()` returns `local`, backend persistence includes
`LocalNdjsonAnalyticsEventRepository`. Its file is resolved from
`resolveBackendDataRoot()` as `analytics/events.ndjson`; with the default data root,
the repository writes `.local/trasolve/analytics/events.ndjson`.

Each line is one UTF-8 `AnalyticsEvent` JSON object followed by LF (`\n`). Writes are
serialized in process, validate the shared event schema, verify that an existing
file ends at an NDJSON boundary, append one complete line, and sync the file. The
repository exposes no update or delete operation.

`read()` returns an `AsyncIterable` and reads a bounded file snapshot line by line.
It supports inclusive `from`/`to` UTC timestamps plus exact `sessionId` and
`eventType` filters without loading the full file into memory. A missing file is an
empty event stream.

Blank, invalid JSON, or schema-invalid lines raise `AnalyticsEventStorageError` with
kind `malformed_line` and the line number. An incomplete final line also blocks later
appends. Corruption is therefore explicit and is never silently skipped.
