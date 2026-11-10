# Frontend architecture

This document describes the current `frontend/src` layout. It replaces the historic
page-local directory move inventory. Public contracts and URLs remain compatible.

## Module ownership

| Layer      | Responsibility                                                   | Allowed source dependencies                                 |
| ---------- | ---------------------------------------------------------------- | ----------------------------------------------------------- |
| `app`      | Bootstrap, providers, routes, global styles                      | All layers                                                  |
| `pages`    | Route composition, admin screens, development pages              | Features, entities, shared, map, api                        |
| `features` | User actions, orchestration, feature state and presentation      | Features through public entries, entities, shared, map, api |
| `entities` | Place, trip and route-job data, repositories and mappings        | Shared; other entities are independent                      |
| `shared`   | Product-neutral UI, transport helpers, preferences, localization | Shared                                                      |
| `map`      | Provider-neutral map contracts and Google implementation         | Map, shared                                                 |
| `api`      | Common service clients such as tcache                            | Api, shared                                                 |

Feature/entity consumers import the slice root `index.ts`; internal files use
explicit local modules. Nested public barrels, legacy source roots, deep relative
imports and circular dependencies (including type-only imports) are rejected.
Features may compose other features through their public APIs. A new dependency
must still have a concrete responsibility; extracting code does not justify a cycle.

## Component and state contracts

Display components accept the data they render and named event callbacks. They do
not resolve a global container, create repositories or write trip state. Local
presentation state such as expansion or a draft belongs near its input. Feature
hooks own requests and editing workflows; composition roots connect them to views.
A hook extraction is a responsibility boundary, not permission to grow another
large file. Function-size warnings identify remaining candidates for decomposition.

| State/resource                                             | Owner and lifetime                                               |
| ---------------------------------------------------------- | ---------------------------------------------------------------- |
| Authentication and billing environment                     | App providers; backend is authoritative                          |
| Trip catalog and repository                                | `features/map-workspace/MapWorkspacePage.tsx`                    |
| Live editable trip                                         | One immutable TripStore per selected TripSession                 |
| Undo/redo, local edits, autosave and confirmed batches     | TripEditController and command dispatcher                        |
| Layer visibility in editable trips                         | Optional `TripDay.hidden`; command/controller edits and autosave |
| Selection, active day, viewer visibility and camera intent | Workspace UI hooks; read-only overrides never save               |
| SDK map, markers, polylines and listeners                  | GoogleMap / MapRuntime / object controller                       |
| Chat threads and browser persistence                       | `ai-chat/model/useChatThreads.ts`                                |
| Chat request cancellation and response application         | `ai-chat/model/useChatSubmission.ts`, `ui/useThreadRequests.ts`  |
| Chat focus, scroll and outside-menu listeners              | `ai-chat/ui/useChatPanelEffects.ts`                              |
| Optimization request, constraints, schedule                | Separate modules under `route-optimization/model`                |
| Testbed job state, stream and gateway requests             | Feature model hooks; views receive data and actions              |

Trip snapshots stay detached and frozen. `reuseJsonValue` preserves unchanged
branches and suppresses identical store publications. `useTripData` subscribes only
to the trip reference; `useTripState` also observes save status and errors.

All user edits, AI plans and optimized schedules enter the shared command path.
`TripEditCommands` defines named editing operations; its controller implements the
single dispatch boundary. The controller owns revision/lock state. Separate
`tripAutosave`, `persistedTripBatch`, `tripPersistenceMapping` and
`tripCommandExecution` modules handle persistence and input policies through
explicit contracts. No second mutable trip store is introduced.

Layer visibility uses an optional `hidden` boolean on each day. Missing values
mean visible; no default is materialized, preserving existing StoredTripV1
canonical documents. Individual and bulk toggles enter the same command/history
and autosave path as other edits. The bulk toggle hides every day when any is
visible, and shows every day when none is visible, as one undoable edit.
Shared-trip viewers start from saved visibility and may toggle their local view
without changing the owner's data. Selection and detail cards exclude hidden days.
The bulk control reuses the existing localized `all` label and an eye icon;
`aria-pressed="mixed"` represents partially visible days. Empty trips disable it.

## Asynchronous work and maps

Requests accept AbortSignal. After an await, cancelled or superseded work must not
publish into a replacement session. The owner aborts requests and releases timers,
subscriptions and SDK handles. Session construction performs no I/O. Cleanup stays
safe under StrictMode. Unknown save outcomes still require canonical readback;
they must not be retried blindly or reported as committed.

`google.maps` objects and types stay in `map/runtime` and `map/adapters`. Marker
creation/setters live in `createGoogleMarker`; the object controller owns its
registry, layer membership and disposal. Markers and polylines retain their IDs and
update attributes instead of being recreated for UI changes. Map locale reload
status is exposed through `map/locale.ts`, without leaking SDK types to preferences.

HTTP calls live in `api`, `shared/api` or a feature's `api` directory. Components,
domains and map runtime do not issue raw fetch calls. Routes and Places go through
the backend. API keys and billing reconciliation remain server-owned.

## Size, CSS and localization

- Aim for 300 nonblank, noncomment lines per TS/TSX file; ESLint errors above 400.
- Ordinary functions/hooks warn above 80 such lines; TSX functions warn above 150.
  These warnings are review signals, not exceptions that disable the file budget.
- Split by responsibility. Do not compress statements or create numbered fragments
  to satisfy a counter. Generated resources are not TS/TSX application source.
- Stylesheet entry files import cohesive subfiles in their original cascade order.
  Media queries, selectors and declarations remain ordered. Use semantic theme
  tokens and `--shadow-map-overlay` for map floating surfaces.
- Preserve localization keys and ko/ja/en/mn resources. UI strings use `L`/`NL`
  according to AGENTS.md; extracting code does not authorize new literal strings or
  edits to the localization spreadsheet.

## Enforcement and validation

`npm run architecture:check` uses dependency-cruiser with the SWC parser because the
project uses TypeScript 7 and dependency-cruiser's tsc parser supports earlier
compiler APIs. SWC includes explicit type imports. The runner checks source coverage
so an unavailable parser cannot produce a misleading zero-module success.
Additional AST checks enforce network/SDK boundaries, legacy paths and public entries.
Configuration lives in `.dependency-cruiser.cjs`, `eslint.config.mjs` and
`infra/architecture/check-frontend-dependencies.mjs`. CI runs on impl pushes and PRs.

Required checks: architecture, typecheck, lint (including localization), build and
formatting. No automated test files, fixtures, fake SDKs or new mock branches are
added. Browser checks use the actual service and its existing development modes.
See [Frontend verification](frontend-verification.md) for the manual scenarios and
recorded limitations. Source ownership documentation must change with its code.

## Route and export presentation

`map-workspace/components/RouteSettingsPanel` is the shared route content for map
anchors and layer cards. The wrappers own placement only. `model/useRouteOptions`
owns cancellable requests; `api/routeDetails` keeps all returned alternatives.
Route result cards, proportional journey bars and expandable itineraries render
normalized data without saving geometry or rewriting schedule times.

Place cards defer their surface until the details request settles; failed requests
show the existing fallback/error state. AnchoredMapCard ignores an empty child
during initial measurement. Markers remain mounted during loading.

`files/TripScheduleDocument` owns the standalone A4 itinerary and print stylesheet.
`printTripSchedule` captures a detached trip snapshot, opens the print document
inside the click, waits for fonts and invokes the browser's print/PDF-save flow.
It makes no Places/Routes calls and React escapes user-authored values. The PDF
module is loaded only when selected; existing KML/KMZ serializers stay unchanged.

Billing's `TokenBalanceGauge` is shared by optimization and the plan dialog; it
displays only the authoritative current balance. Charge estimates and affordability
checks remain server-backed. Decorative foil animations respect reduced motion.
