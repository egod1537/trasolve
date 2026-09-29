# Analytics query API

The analytics query API is intended for the internal Analytics panel and local
debugging. It is enabled outside production. Production returns `403` until an
explicit staff role/authorization policy replaces this deny-by-default gate.

## Endpoints

- `GET /api/analytics/sessions`
- `GET /api/analytics/sessions/:sessionId/events`
- `GET /api/analytics/flows`
- `GET /api/analytics/overview`
- `GET /api/analytics/funnels`
- `GET /api/analytics/funnels/:funnelId`

All endpoints return JSON with `Cache-Control: no-store`. Session events are
ordered by `occurred_at`, then storage creation order and event ID.

## Query parameters

- `from`, `to`: inclusive ISO 8601 UTC event-time bounds.
- `eventType`: a shared analytics event enum value.
- `screen`: a shared analytics screen registry value.
- `userId`: an exact authenticated user UUID.
- `anonymous=true`: only events without a user ID.
- `anonymous=false`: only authenticated events.
- `limit`: page size from 1 to 200; defaults to 50.
- `cursor`: opaque cursor returned by the previous response.

`userId` cannot be combined with `anonymous=true`. Unknown, duplicated, or
invalid query parameters are rejected with `400`.

The session list returns `{ sessions, nextCursor }`. Each summary contains its
event-time range, matched event count, distinct authenticated user IDs, and
whether it contains anonymous events. It also includes the mixed-mode path
length after consecutive duplicate nodes are collapsed. A session can contain
both anonymous and authenticated events because the browser tab session
survives login.

The timeline endpoint returns `{ events, nextCursor }`. Event metadata is
returned as stored; the ingestion privacy policy therefore remains the required
boundary against user-authored text, email addresses, search text, and
credentials.

## Flow aggregation

`GET /api/analytics/flows` accepts `from`, `to`, `screen`, `eventType`,
`minimumCount`, and `nodeMode`. `nodeMode` is `mixed` by default and also accepts
`screen` or `domain_event`. `minimumCount` defaults to 1 and is applied to node
visits and edge occurrences.

The repository applies the time, screen, and event-type filters before the
on-demand aggregation engine consumes the iterator. The response contains
`summary`, `nodes`, and `edges` in stable identifier order. Node `identifier`
values are raw screen or domain-event identifiers; the UI translates labels at
the presentation boundary. Each node includes visit and unique-session counts.
Edge `ratio` remains relative to all outgoing transitions before the
minimum-count display threshold, so hidden low-volume edges are still
represented in the denominator.

`summary.avgPathLength` is the aggregated node occurrence count divided by all
matched sessions, including sessions with no nodes in the selected mode. An
empty result reports zero.

## Overview aggregation

`GET /api/analytics/overview` accepts the inclusive `from` and `to` UTC bounds.
It streams the matching raw events into the default quality analysis and returns
the session/event/path/backtrack summary together with the default funnel's
stage and transition conversion/drop-off metrics. Empty periods return zeroed
summary values and zero-reach funnel stages instead of an error.

This endpoint is the data boundary for the `/analytics` Overview screen. Like
the other analytics read endpoints, production access remains deny-by-default
until an internal/admin authorization policy replaces the current gate.

## Funnel aggregation

`GET /api/analytics/funnels` accepts no query parameters and returns
`{ funnels }`. Each item contains the stable funnel `id`, stable `nameKey`, step
count, and `enabled` state. The list uses primary-funnel priority followed by
secondary funnels. `nameKey` is not localized response copy; the UI maps it to
a static localization key at the presentation boundary.

`GET /api/analytics/funnels/:funnelId` accepts inclusive `from` and `to` UTC
bounds and an optional `locale` (`ko`, `ja`, `en`, or `mn`). Its response is
`{ funnelId, range, totalSessions, averageCompletionTimeMs, steps, attribution }`.
Missing range values are returned as `null`, making the applied range explicit.
Average completion time includes only sessions that reach the final step.

The `trip_share` response populates `attribution` by joining successful
owner-side `share_enable` and `share_link_copy` events to later
`shared_trip_view` events with the privacy-safe `shareId`. Other funnel
responses return `attribution: null`. The metrics include enable-to-copy and
copy-to-view conversion, copied/viewed share counts, unique viewer sessions,
average viewers per copied share, copy-to-first-view time, and
owner-self/external/anonymous viewer session counts. The public share token is
never accepted or returned by the analytics API.

Unknown funnel IDs return `404`. Malformed, reversed, duplicated, or unknown
query parameters return `400`. The service asks the shared
`AnalyticsRepository` for the bounded raw-event iterator, so local NDJSON and
PostgreSQL use the same aggregation path. Locale filtering remains in the
provider-neutral TypeScript engine.

The result is aggregate-only: it contains no event payload, metadata, session
ID, or user ID. The endpoints share the analytics read gate, including the
production deny-by-default policy.
