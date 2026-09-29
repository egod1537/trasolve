# Analytics session timeline

The Sessions view consumes the paginated analytics session and event APIs. It
is implemented in the `features/analytics-sessions` slice and receives all
user-visible labels from the presentation page.

## Session list

Sessions are ordered by their first matched event in descending order. Each row
shows the shortened session identifier, first and last event times, matched
event count, identity state, and mixed-mode analysis path length. The full
opaque session ID remains available as the row title and is used unchanged when
requesting its timeline.

Path length uses the same mixed-node extraction and consecutive-node collapse
rules as flow-quality analysis. Local storage reuses the aggregation engine.
PostgreSQL calculates the equivalent path over the filtered events with a
window query. It does not modify or pre-aggregate raw events.

## Event timeline

Selecting a session requests `GET /api/analytics/sessions/:sessionId/events`.
Pages remain in backend order: `occurred_at ASC`, with storage creation order
and event ID providing deterministic ties. The session list loads 50 rows per
page and a timeline loads 100 events per page. Each has independent loading,
retry, and cursor state.

Timeline rows show browser-local time, event type, screen, target, and metadata.
Metadata is initially presented as up to four compact key/value items. The
stored JSON can be expanded when exact diagnostics are needed. This is only a
read representation; the ingestion rule prohibiting user-authored or sensitive
metadata remains the privacy boundary.
