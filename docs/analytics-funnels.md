# Analytics funnel definitions

Funnel analysis is config-driven. Shared schemas and types describe a funnel;
the backend registry selects the product flows, and the aggregation engine applies
the same ordered matching semantics to every definition.

## Domain contract

`FunnelDefinition` contains a stable `id`, stable `name`, optional internal
`description`, and one or more ordered `FunnelStep` values. A step has a stable
`id` and `label`, plus one or more event predicates:

- `eventType`
- `screen`
- `target`
- allowlisted analytics `metadata`

All predicates present on a step are combined with AND. Definition and step IDs,
`name`, and `label` use lower-case `snake_case`. They are analytics identifiers,
not user-facing text.

A step can instead provide two or more `alternatives`. Every alternative is an
AND condition, while the alternatives array is OR. Direct predicates and
`alternatives` are mutually exclusive. This represents cases such as
`trip_create | trip_select` without adding matcher-specific product branches.

Definitions are validated when the registry module loads. Empty funnels, steps
without a predicate, duplicate step IDs, unknown event identifiers, unknown
metadata fields, and invalid metadata values are rejected.

## Ordered matching

Events are grouped by session and sorted by occurrence timestamp, then by event
ID for deterministic ties. For each session, the engine finds the first event
matching step 1. It searches for step 2 only after that event, and continues in
the same way. Unrelated events between steps are ignored.

A single event cannot satisfy two steps because the next search starts at the
following event. Repeated predicates are therefore supported. For example, the
`route_reoptimization` funnel can match an initial `result_view`, later
optimization events, and a second `result_view`.

Each session contributes at most once to each step. If a step is not found, that
session cannot enter later steps.

## Metrics

`FunnelResult.totalSessions` is the number of sessions remaining after filters,
including sessions that never enter the first step. Each step reports:

- `enteredSessions`: unique sessions reaching the step
- `conversionFromPrevious = step N sessions / step N-1 sessions`
- `overallConversion = step N sessions / first-step sessions`
- `dropOffSessions = step N sessions - step N+1 sessions`
- `dropOffRate = dropOffSessions / step N sessions`
- `averageTimeFromPreviousMs` and `medianTimeFromPreviousMs`: timestamp
  differences between the matched step N-1 and step N events

The first step has no previous-step conversion or transition time, so those
fields are `null`. A transition with no completed samples also has `null` time
values. The final step has zero drop-off because no later step is defined. A
zero denominator produces a finite zero rate.

The final step's `overallConversion` is the funnel's overall conversion. Only
sessions reaching both adjacent steps contribute to transition timing.
`averageCompletionTimeMs` is the average elapsed time from the matched first
step to the matched final step among completed sessions only; it is `null` when
no session completes the funnel.

`buildFunnelSessionProgressions` exposes the deterministic per-session match
sequence used by the aggregate. It includes matched step IDs, source event IDs,
timestamps, and a completion flag; a session can contribute at most once per
step.

## Filters

The engine accepts inclusive `from` and `to` UTC timestamps, `locale`, and an
`authenticated` session filter. Date and locale filters are applied to events
before grouping. Events without locale metadata do not match a locale filter.

Authentication is evaluated after grouping: `authenticated=true` keeps a
session when at least one in-range event has a backend-resolved `userId`;
`authenticated=false` keeps only sessions whose in-range events are all
anonymous. This preserves the pre-login steps of an anonymous-to-login session.
Device class is intentionally left as a future allowlisted dimension.

The frontend adds the current stable locale code (`ko`, `ja`, `en`, or `mn`) to
every event. It is analysis metadata, not user-authored content.

The first implementation aggregates validated repository output in TypeScript.
It has no cache and does not require window SQL. Indexed raw queries, daily
precomputation, or a short TTL cache can be introduced without changing this
provider-neutral result contract.

## HTTP API

The internal Analytics UI reads the registry from
`GET /api/analytics/funnels` and one aggregate from
`GET /api/analytics/funnels/:funnelId?from=...&to=...&locale=...`. The API
validates responses with the shared funnel schemas and never exposes raw event
metadata, session IDs, or user IDs. Unknown IDs return `404`; invalid ranges
return `400`.

`FunnelAggregationService` depends only on `AnalyticsRepository`. It pushes
date bounds into `queryRaw` for both local and PostgreSQL storage, then passes
the iterator to the common engine. The HTTP layer does not branch on persistence
mode.

## Analytics UI

`/analytics` has Overview, Flow Graph, Funnels, and Sessions tabs. A single
page-level UTC query range drives all four tabs; the Funnels feature does not
keep a separate period state. The default selected definition is
`route_optimization`.

The funnel view uses responsive CSS rather than another visualization package.
Desktop lays steps and transition connectors horizontally, while narrow screens
reflow them into a vertical sequence. Cards show entered sessions, previous-step
conversion, and drop-off. Selecting a card reveals the full step metrics,
including overall conversion and average/median transition time. The largest
drop-off uses the warning palette instead of error styling.

The summary reports started and completed sessions, final-step conversion,
largest drop-off, and the engine-provided average completion time. Funnel and
step identifiers remain stable API values; the presentation maps them to static
`analytics:*` localization keys.

## Registry

The initial backend registry contains:

| Priority  | Funnel ID              | Ordered steps                                                                  |
| --------- | ---------------------- | ------------------------------------------------------------------------------ |
| Primary   | `route_optimization`   | workspace → optimization start → completion → result → apply                   |
| Primary   | `trip_entry`           | landing → login/enter-map → trip picker → create/select → workspace            |
| Primary   | `add_place`            | place search → result selection → add confirmation → successful add            |
| Secondary | `route_reoptimization` | result → place edit/reorder → optimization start → completion → updated result |
| Secondary | `trip_share`           | share modal open → share enable → link copy                                    |

Add a validated definition to `funnelDefinitions.ts` to register another funnel;
the matching and metric engine needs no conditional branch for a new config.
Registry IDs are unique and immutable after collection begins.

The legacy Overview quality funnel derives the node-compatible projection of
`route_optimization`. It omits the target-based apply step; the full funnel
engine retains it.

## Share-view attribution

`trip_share` ends at link copy for ordinary same-session analysis. A
`shared_trip_view / shared_trip_viewer` event commonly belongs to another
browser, session, or user and must never be appended as step 4 of that funnel.

`TRIP_SHARE_VIEW_ATTRIBUTION` defines that conversion separately with
`joinMode=cross_session_attribution`. The backend derives a stable `shr_...`
`shareId` by domain-separated SHA-256 hashing of the public token. Only that
one-way identifier is returned to the UI and stored in analytics metadata. The
raw public token and share URL are never analytics fields, and `shareId` is
correlation data rather than an authorization credential.

Owner-side outcomes are recorded only after their actions succeed:

- `share_enable` after the enabled share settings response returns a `shareId`;
- `share_link_copy` after the browser clipboard write succeeds.

The public page records `shared_trip_view` only after
`GET /api/shared-trips/:token` returns a valid shared Trip. Invalid, disabled,
and missing tokens therefore do not count as views. The backend response
classifies the viewer as `owner_self`, `external_authenticated`, or `anonymous`
without exposing either user ID.

For `GET /api/analytics/funnels/trip_share`, `attribution` has these definitions:

- `enabledSessions`: unique sessions with `share_enable`;
- `copiedSessions`: enabled sessions that later copy the same `shareId`;
- `copiedShareIds`: unique attributed shares copied by those progressions;
- `viewedShareIds`: copied shares with at least one later successful view;
- `viewerSessions`: unique viewing sessions across attributed shares;
- `copyToViewConversion`: `viewedShareIds / copiedShareIds`;
- `averageViewersPerSharedTrip`: unique `(shareId, viewer session)` pairs divided
  by copied shares;
- copy-to-first-view duration: the first eligible view timestamp minus the first
  attributed copy timestamp, averaged or medianed across viewed shares.

Owner self-view sessions are reported separately. External viewer sessions
include both authenticated non-owners and anonymous viewers; the anonymous
subset is also returned explicitly.

## Instrumentation coverage

Existing identifiers retained for historical continuity:

- `trip_create`, `trip_select`, `add_place`, `optimize_start`, and
  `optimize_apply`;
- `share_open` for share-modal open, `share_toggle` for share enable, and
  `copy_share_link` for link copy;
- `shared_trip_view / shared_trip_viewer` after a public shared-trip loads.

New instrumentation:

- `screen_view / place_search` when a real autocomplete request starts;
- `button_click / place_search` for explicit search submission;
- `button_click / place_select` when a result is selected;
- `button_click / place_edit` when a changed place name is committed;
- `button_click / reorder` after a drag or keyboard reorder is committed.

Search terms, place names, Trip IDs, share links, and share tokens are not
attached to these events. Only the backend-derived `shareId` is used to connect
owner and viewer sessions.

## Localization boundary

APIs and aggregation results use only stable funnel and step IDs. A frontend must
map those IDs to static localization keys and call `L()` at the presentation
boundary. Do not translate IDs, return localized copy from the engine, or use
`name` and `label` directly as user-visible strings.

## Verification scenarios

Release verification must cover:

- a complete funnel and a session that drops after step 2;
- a duplicate step event that still counts the session once;
- input whose events arrive out of timestamp order;
- unrelated events between matching steps;
- metadata predicates combined with event/target predicates;
- a wrong metadata value followed by the first valid event;
- repeated event types such as `result_view → ... → result_view`;
- first-step drop-off and sessions that never enter the funnel;
- equal timestamps with deterministic event-ID ordering;
- average and median timing for odd and even sample counts;
- empty input and a single-step definition;
- date, locale, authenticated, and anonymous filters;
- invalid empty steps and duplicate step IDs.

Repository policy does not permit committed automated test fixtures. Use
disposable inline data for these checks and leave the production code free of
test-only branches.

## Funnel QA matrix

The disposable regression dataset uses only synthetic session names, stable
identifiers, fixed UTC timestamps on `2026-01-01`, and the non-identifying UUID
`11111111-1111-4111-8111-111111111111`. It contains no email address, person
name, Trip title, place name, search term, public share token, or share URL.

| Case | Synthetic session    | Timeline and expected progression                                                                                                         |
| ---- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| A    | `route-complete`     | `00:00:00` workspace → `00:00:10` start → `00:00:30` complete → `00:00:35` result → `00:00:40` apply; complete                            |
| B    | `route-start-drop`   | `00:01:40` workspace → `00:01:50` start; drop before complete                                                                             |
| C    | `route-result-drop`  | `00:03:20` workspace → `00:03:30` start → `00:03:50` complete; drop before result                                                         |
| D    | `route-repeat`       | complete/result, edit, second optimization, second result, apply; the ordinary funnel uses the first matching event for each ordered step |
| E    | `route-unrelated`    | Complete optimization with preference, add/remove, reorder, and screen events interleaved; unrelated events do not break matching         |
| F    | `add-place-complete` | search → select in 5 s → add click in 5 s → successful add in 10 s                                                                        |
| G    | `trip-entry-drop`    | landing → login in 10 s → picker in 10 s; 100% drop before create/select                                                                  |
| H    | `share-owner/viewer` | modal → enable in 10 s → copy in 10 s; another session views the same safe `shareId` after 30 s                                           |

With all nine sessions in one unbounded query, the expected aggregate checkpoints
are:

| Funnel               | Entered sessions by step | Step conversion after the first | Drop-off sessions | Average transition time   | Median transition time |
| -------------------- | ------------------------ | ------------------------------- | ----------------- | ------------------------- | ---------------------- |
| `route_optimization` | `5, 5, 4, 3, 3`          | `100%, 80%, 75%, 100%`          | `0, 1, 1, 0, 0`   | `—, 9s, 20s, 6.667s, 20s` | `—, 10s, 20s, 5s, 10s` |
| `add_place`          | `1, 1, 1, 1`             | `100%, 100%, 100%`              | `0, 0, 0, 0`      | `—, 5s, 5s, 10s`          | `—, 5s, 5s, 10s`       |
| `trip_entry`         | `1, 1, 1, 0, 0`          | `100%, 100%, 0%, 0%`            | `0, 0, 1, 0, 0`   | `—, 10s, 10s, —, —`       | `—, 10s, 10s, —, —`    |
| `trip_share`         | `1, 1, 1`                | `100%, 100%`                    | `0, 0, 0`         | `—, 10s, 10s`             | `—, 10s, 10s`          |

The route funnel average completion time is 55 seconds. The add-place and share
funnels each average 20 seconds. Trip entry has no completion duration. Share
attribution expects one enabled session, one copied session, one copied and
viewed `shareId`, one anonymous external viewer session, 100% copy-to-view
conversion, one viewer per copied share, and a 30-second copy-to-first-view time.

Run the repository check against events appended in reverse order, then create a
new repository instance before querying. This verifies timestamp ordering,
NDJSON persistence across restart, and independence from append order. Query the
real funnel HTTP handler and additionally require an unknown funnel to return
404, a reversed range to return 400, and a future empty range to return zero
sessions and zero entered steps.

PostgreSQL parity requires a disposable migrated database, the same event rows,
and equality of the four complete API response objects above. Do not point this
check at a shared or production database. The check is pending whenever neither
Docker nor `DATABASE_URL` is available.

Manual `/analytics` Funnels QA must cover:

- loading while list/result requests are pending and retry after a forced API
  failure;
- an empty future period, the 100% add-place funnel, and the severe trip-entry
  drop-off;
- selection and detail metrics for every step;
- an artificially long localized step label without horizontal text overflow;
- 1000 px and 720 px breakpoints, including the vertical mobile flow and the
  single-column KPI layout at 480 px;
- `ko`, `ja`, `en`, and `mn` after production localization resources are synced.
