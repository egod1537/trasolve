# Trasolve analytics contract and operations

This document is the source of truth for raw UX analytics, metric definitions,
privacy constraints, and release verification. Raw events are append-only. A
change to analysis logic is applied by aggregating the retained raw events again,
never by updating historical events.

## Event contract

`@trasolve/shared` owns the runtime schemas and TypeScript types. The initial
event types are:

- `screen_view`
- `button_click`
- `add_place`
- `remove_place`
- `optimize_start`
- `optimize_complete`
- `result_view`
- `share_enable`
- `share_link_copy`
- `shared_trip_view`

The persisted `AnalyticsEvent` fields are:

| Field       | Contract                                                          |
| ----------- | ----------------------------------------------------------------- |
| `id`        | Backend-generated UUID                                            |
| `sessionId` | Non-empty opaque string; correlation only                         |
| `userId`    | Authenticated backend user UUID or `null`                         |
| `eventType` | Shared event enum                                                 |
| `screen`    | Shared stable screen identifier                                   |
| `target`    | Shared stable target identifier or `null`                         |
| `timestamp` | Client occurrence time in ISO 8601 UTC                            |
| `metadata`  | Strict allowlisted JSON object or `null`; see the privacy section |

The ingestion body omits `id` and `userId`. `POST /api/analytics/events`
validates a maximum 16 KiB JSON body, creates the event ID, resolves `userId`
from backend authentication, appends the event, and returns `204 No Content`.
Supplying extra fields, including a spoofed `userId`, fails strict validation.

## Screen and target naming

Identifiers use lower-case `snake_case` and come from `ANALYTICS_SCREENS` and
`ANALYTICS_TARGETS`. Never derive an identifier from translated text,
`textContent`, CSS classes, array indexes, database IDs, or user input. Once
collection begins, add a new identifier instead of renaming an existing one.

Actionable controls use both attributes where possible:

```tsx
data-analytics-id={ANALYTICS_TARGETS.optimizeStart}
data-analytics-screen={ANALYTICS_SCREENS.routeOptimization}
```

The complete inventory and duplicate-element policy are in
[`analytics-naming.md`](./analytics-naming.md).

## Session policy

The browser lazily creates a UUID for the first event and stores it in
`sessionStorage` under `trasolve.analytics.session_id`. The ID survives route
changes, reloads, login/logout, and language changes in the same tab. A new tab
gets a separate session, and closing the tab ends it. If `sessionStorage` is
unavailable, an in-memory UUID preserves correlation until reload.

The session ID is not a credential and must never be used for authorization.
An anonymous event and a later authenticated event can intentionally have the
same `sessionId`; each event records the identity resolved at ingestion time.
See [`analytics-session.md`](./analytics-session.md).

## Client and performance boundary

UI code calls `trackEvent()` or `screenView()` and does not know the repository.
`trackEvent()` constructs the automatic session and timestamp fields, starts the
request without awaiting it, catches transport failures, and never blocks the
product action. `useScreenView()` schedules the event from an effect so React
StrictMode's probe cleanup cancels the duplicate send.

Analytics adds no synchronous repository work to a product interaction. The map
annotation observer and aggregation fetch are mounted only for
`?analytics=1`; there is no analytics polling on the normal map. Performance
release checks still require browser profiling because network, device, and data
volume cannot be proven by typecheck or build.

## Privacy contract

Metadata is a strict schema, not arbitrary JSON. Only these keys are accepted:

| Key              | Accepted value                                                   |
| ---------------- | ---------------------------------------------------------------- |
| `locale`         | Stable UI locale: `ko`, `ja`, `en`, or `mn`                      |
| `travelMode`     | Shared route travel-mode enum                                    |
| `resultCount`    | Integer from 0 through 100,000                                   |
| `success`        | Boolean                                                          |
| `enabled`        | Boolean feature state after an explicit toggle                   |
| `source`         | Shared finite source enum                                        |
| `durationBucket` | `under_1s`, `1s_to_3s`, `3s_to_10s`, `10s_to_30s`, `30s_or_more` |
| `errorCode`      | Stable lower-case `snake_case` code, at most 64 characters       |
| `shareId`        | Backend-derived `shr_...` cross-session correlation identifier   |
| `viewerType`     | `owner_self`, `external_authenticated`, or `anonymous`           |

Do not store trip titles, memos, place names, raw search terms, email addresses,
share tokens, OAuth/session credentials, URLs containing credentials, or any
other user-authored text. Counts and bounded categorical dimensions are
preferred. A new metadata dimension requires a shared schema change and a
privacy review before instrumentation.

Instrumentation audit:

Every frontend event includes the stable `locale` dimension. Additional
area-specific metadata is:

| Area                       | Additional metadata                                                  |
| -------------------------- | -------------------------------------------------------------------- |
| Landing and preferences    | None                                                                 |
| Trip picker                | Allowlisted creation/selection `source`                              |
| Add/remove place           | Allowlisted `source` and `success`                                   |
| Route optimization/results | `source`, `success`, and enum `travelMode`                           |
| Sharing controls           | Boolean `enabled`; outcome events use only backend-derived `shareId` |
| Shared Trip viewer         | `shareId` and backend-derived `viewerType` after a successful load   |
| Other screen views         | None                                                                 |

`shareId` is a domain-separated SHA-256 derivative of the random public share
token and is prefixed with `shr_`. It cannot be used to retrieve a shared Trip.
The public token, public URL, Trip ID, owner ID, and viewer ID are not stored in
analytics metadata. Share attribution event schemas require `shareId`, and all
unrelated event types reject it.

The backend applies the same shared schema before persistence. Existing stored
events that do not satisfy the contract produce an explicit storage diagnostic;
they are not silently skipped.

## Persistence

`TRASOLVE_PERSISTENCE_MODE=local` stores one UTF-8 JSON event per line at
`<resolveBackendDataRoot()>/analytics/events.ndjson` (normally
`.local/trasolve/analytics/events.ndjson`). Appends are serialized in-process,
the file is synchronized after each complete newline, reads use a snapshot and a
stream, and malformed or partial lines raise an `AnalyticsEventStorageError`.

`TRASOLVE_PERSISTENCE_MODE=postgres` runs immutable migration
`003_analytics_events.sql` and uses `trasolve.analytics_events`. Inserts are
parameterized, metadata is `jsonb`, and indexes cover session, event type, and
non-null user queries by occurrence time. User deletion sets `user_id` to null
while retaining the raw event. Runtime repositories expose append and reads only;
there is no update or delete method.

Both repositories implement the same filtering and session-summary contract.
Session events are ordered by occurrence time with deterministic tie-breakers.

## Read APIs and access

- `GET /api/analytics/overview`
- `GET /api/analytics/flows`
- `GET /api/analytics/funnels`
- `GET /api/analytics/funnels/:funnelId`
- `GET /api/analytics/sessions`
- `GET /api/analytics/sessions/:sessionId/events`

Session and event endpoints are paginated. Filters are validated against an
explicit query allowlist. Development enables read access; production denies it
until an internal/admin authorization policy is connected. `?analytics=1` is a
display flag, never authorization.

## Analysis path and metrics

Raw events are grouped by `sessionId`, ordered by `timestamp` and event ID, and
converted to nodes. The default `mixed` mode maps `screen_view` to
`screen:<screen>` and major domain events to `event:<eventType>`; `button_click`
remains an intent event and is not a path node. Consecutive equal nodes collapse
by default. Empty and single-node sessions are valid.

The primary route-optimization definition is:

1. `screen:map_workspace`
2. `event:optimize_start`
3. `event:optimize_complete`
4. `event:result_view`
5. `button_click / optimize_apply`

A session reaches a later stage only when that node occurs after the previous
reached stage. Unrelated nodes may occur between stages. For adjacent stages A
and B:

- `conversionRate = sessions reaching B / sessions reaching A`
- `dropOffSessions = sessions reaching A - sessions reaching B`
- `dropOffRate = dropOffSessions / sessions reaching A`

Zero-denominator rates are zero. A backtrack occurs when the path enters a node
already visited earlier after at least one different node; `A → B → A` adds one.
Path length is the number of extracted, collapsed nodes. `avgPathLength` is the
arithmetic mean across all matched sessions, including zero-node sessions;
`medianPathLength` uses the ordinary sorted midpoint rule.

Flow edges report occurrence count, unique-session count, and
`edge count / all outgoing edge occurrences from the source`. Target overlay
metrics group `button_click` by `screen + target`. Conversion means the clicked
session has a later mixed-mode node; drop-off means it does not. The next
transition is the first later mixed-mode node, and the response keeps the five
highest-count destinations with stable identifier ordering for ties.

Reusable product funnels use validated ordered step definitions rather than a
single hardcoded node list. They support AND-combined event, screen, target, and
metadata predicates, repeated event types, and average/median transition timing.
See [`analytics-funnels.md`](./analytics-funnels.md).

## Map overlay

`/map?analytics=1` mounts the overlay; absent `analytics` or `analytics=0` does
not. It can be combined with `readonly=1`. The page parses the query once and
passes a boolean to the workspace.

The overlay matches aggregation data to visible `[data-analytics-id]` elements
using `screen + target`, observes DOM/size changes without polling, and displays
click-count badges outside the normal layout. Only badges and popovers accept
pointer events. The underlying controls and page layout remain unchanged.
Period changes and refreshes request aggregation again. See
[`analytics-overlay-mode.md`](./analytics-overlay-mode.md).

The standalone `/analytics` area shares one period filter across Overview, Flow
Graph, Funnels, and Sessions. The Funnels tab consumes the config-driven funnel
API and maps stable funnel/step IDs to localized presentation labels. See
[`analytics-funnels.md`](./analytics-funnels.md).

## Canonical validation dataset

Use UTC timestamps increasing in the listed order. IDs are distinct UUIDs. The
authenticated user UUID in session `auth` is
`aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`.

| Session    | Ordered mixed-mode events                                                                                     | Purpose                       |
| ---------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `complete` | `screen:map_workspace → event:add_place → event:optimize_start → event:optimize_complete → event:result_view` | Normal funnel completion      |
| `drop`     | `screen:map_workspace → event:add_place`                                                                      | Exit before optimization      |
| `back`     | `screen:map_workspace → screen:trip_picker → screen:map_workspace`                                            | `A → B → A` backtrack         |
| `auth`     | anonymous `screen:landing →` authenticated `screen:map_workspace`, same session ID                            | Anonymous-to-login continuity |
| `single`   | `screen:preferences`                                                                                          | Single-event session          |
| none       | Query a non-overlapping time range                                                                            | Empty period                  |

Expected full-period quality result:

- 5 sessions, 13 events
- path lengths `5, 2, 3, 2, 1`; average `2.6`, median `2`
- one backtrack in one session
- legacy Overview funnel stage sessions `4, 1, 1, 1`
- legacy Overview conversion rates `0.25, 1, 1`
- legacy Overview drop-off rates `0.75, 0, 0`

The empty-period result contains zero sessions/events, zero path lengths and
backtracks, zero sessions at every funnel stage, and finite zero rates.

## Release verification runbook

Repository policy does not permit committed automated test files, test-only
fixtures, helpers, dependencies, or application test branches. Keep the
canonical dataset above in the runbook and inject it only into disposable local
or PostgreSQL environments during release verification.

### Local pipeline

1. Start the backend with `NODE_ENV=development`,
   `TRASOLVE_PERSISTENCE_MODE=local`, and a new disposable
   `TRASOLVE_DATA_DIR`.
2. Submit the canonical events to `POST /api/analytics/events`. For the `auth`
   session, establish the normal local login between its two requests.
3. Confirm every response is 204 and every line in
   `analytics/events.ndjson` parses with `analyticsEventSchema`.
4. Restart the backend and confirm the same sessions remain queryable.
5. Compare `/api/analytics/overview`, `/api/analytics/flows`, session pages, and
   event timelines with the expected values above. Query an empty period.
6. Open the Analytics UI when its route is enabled, then open
   `/map?analytics=1`; inspect badge counts, popovers, period refresh, and the
   original button interactions.
7. Corrupt one disposable NDJSON line and confirm reads return an explicit
   storage error. Restore or discard the disposable data root afterward.

### PostgreSQL pipeline and parity

1. Start a disposable PostgreSQL 16 database and set `DATABASE_URL` and
   `TRASOLVE_PERSISTENCE_MODE=postgres`.
2. Run `npm run db:migrate` twice. The first run applies migration 003 and the
   second reports it as already current.
3. Submit the same canonical events through ingestion, restart the backend, and
   run the same read/UI checks.
4. Compare canonicalized JSON from local and PostgreSQL: sort nodes by ID, edges
   by source/target, target metrics by screen/target, and ignore backend-generated
   event IDs and database `created_at`. All remaining aggregate values must be
   identical.
5. Verify `EXPLAIN` for session/type/user time-range queries uses the intended
   indexes at representative volume. Confirm application code has no raw-event
   update/delete path.

### Privacy and interaction audit

1. Search every `trackEvent(` call and inspect every `metadata:` expression.
2. Confirm metadata uses only the shared allowlist and contains no user-derived
   string expression.
3. Submit forbidden keys such as `tripTitle`, `memo`, `query`, `email`, `token`,
   and `credential`; ingestion must return 400 and persist nothing.
4. Record a browser performance trace for an instrumented action with analytics
   on the normal UI. Confirm the action handler does not await analytics and no
   visible interaction delay is introduced.
5. Repeat with storage unavailable; the product action must still complete.

### Required commands

```text
npm run typecheck
npm run lint
npm run format:check
npm run build
npm test
npm run db:migrate
```

`npm test` runs the repository's existing backend contract test only; it is not
an Analytics fixture suite. Database migration and PostgreSQL parity checks are
environment-dependent and must not be reported as passed unless a reachable
disposable PostgreSQL instance was used.
