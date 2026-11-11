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

## AI chat V2

`shared/config/opts.ts` owns `opts.useChatV2`, enabled by default. Set
`VITE_USE_CHAT_V2=false` before starting/building Vite to render the original
panel. `MapAiPanel` keeps its public props/ref API and chooses the view;
`ChatPanelV2` composes the shared thread/submission hooks with small header,
history, transcript, progress and composer views under `ui/v2`.
The wallet's existing `TokenRemainingGauge` is shown beside the close button;
the V2 footer has no cost or balance summary.

V2 POSTs to `/api/chat/stream`. The backend meters one successful chat action,
forwards Responses text deltas and public reasoning-summary deltas only, and
publishes `complete` after wallet settlement. Providers without streaming return
their final message without simulated typing. A bounded, optional follow-up
generation call uses the answer's model; failed/malformed suggestions become an
empty list without discarding the answer. The latest answer's suggestion chips
fill the draft for editing, never send or charge merely on click. Request close
aborts upstream work; partial answers never enter saved history or plan actions.

Per-thread pending responses are transient and guarded by request identity and
AbortSignal. Validated follow-ups/summaries persist with the completed message
under the existing session-storage version. Model history includes message text
only. Existing `renderAssistantActions` still receives the completed answer's
captured trip-selection context and retains the command/preview/apply boundary.
Autoscroll follows output while pinned to the bottom and lets the user scroll up.

## First-use map tutorial

`features/onboarding` owns the Driver.js guide, account progress API client,
debug options, and preference controls. `MapWorkspacePage` mounts one provider
per authenticated user for editable workspaces; shared/read-only and analytics
views do not offer a tour. Stable `data-tutorial` anchors belong to the feature
that renders the actual control. The guide does not synthesize clicks, create
sample data, submit optimizations, or change travel commands.

Version two has six steps: travel creation, Day/layer creation, place search,
adding a place to the itinerary, route optimization, and AI chat. Actual creation,
layer addition, and place addition advance only after their normal application
actions succeed. Search is prefilled with Seoul Station and uses the existing
autocomplete/details endpoints with a Seoul-area bias. Continuing from search
selects a matching station prediction; loading and failure retain the real search
and retry controls. The spotlight moves to the real Add button when its card
mounts. Selection alone never adds a place. Completing/skipping cancels the guided
lookup, and late callbacks cannot clear a skipped/completed marker. Final steps
introduce the optimization tool and AI button without submitting requests. A saved
trip is reopened when resuming an unfinished tour; missing or unavailable trips
fall back to the creation step. Closing the guide records `skipped`.

`GET/PUT /api/auth/tutorial` stores version, status, last step, and trip ID for
the authenticated account. PostgreSQL updates only `users.settings.tutorial`
with `jsonb_set`, preserving other settings, and local persistence adds an
optional field to the existing auth document. No database migration is needed.
Writes are serialized and cancellable in the client, scoped to the user captured
by the provider; the server rejects mismatching account headers and cross-site
writes. Preferences expose errors and allow retrying the latest unsaved state.

Preferences → 기능 보기 → 시작하기 replays the guide without changing stored
completion. Debug preferences additionally offer account settings (`auto`),
display (`always`), hide (`off`), and progress reset. Overrides are local to
the browser and ignored outside debug/development. Developers can set the
default using `opts.tutorialMode` in `shared/config/opts.ts`
(`VITE_TUTORIAL_MODE=auto|always|off`) or use `?debug=1&tutorial=always`
(`off`/`auto` are also accepted). Forced and manual replay never persist progress;
only an explicit reset clears the account marker. Version-one `share` records
remain readable and restart the version-two tutorial. Old tutorial versions restart;
newer versions are not overwritten by an older client during automatic playback.

Guide titles, descriptions, buttons, and preference labels reuse registered
localization keys with the same meaning; no translation spreadsheet or resource
snapshot is changed. The existing Driver.js base CSS loads before the local
theme overrides. Popovers use `--shadow-map-overlay`, wrap on narrow viewports,
and respect reduced-motion settings.

## Debug token usage

`backend/src/options.ts` defaults `BILLING_OPTIONS.unlimitedTokensInDebug` to
true. Local and preview pages opened with `?debug=1` send a token-debug marker.
`TRASOLVE_DEBUG_UNLIMITED_TOKENS=auto` authorizes that marker only while debug
guest authentication is enabled. `false` always meters requests; `true`
authorizes the marker in any sandbox runtime. Live Toss wallets always remain
metered, and the URL never changes payment provider or wallet selection.

For an authorized marker, the server publishes `BillingSummary.unlimited` and
zero chat/optimization costs. Authenticated, validated metered requests skip
reserve/settle; stored balances and real payment operations are unchanged. The
frontend renders the infinity symbol with a full gauge and does not block
optimization or show a charge summary. Missing `unlimited` on older servers
means normal metering.

## Scrolling

`app/providers/SmoothScrolling` installs the shared Lenis wheel controller once
for every route. The controller lazily selects the nearest scrollable ancestor
from the wheel event path, including nested panels and body portals, and reuses
one engine. Vertical, horizontal and Shift+wheel input share the same damping;
line/page wheel deltas are normalized. New scroll regions need no registration.
Scroll chaining respects `overscroll-behavior: contain/none`. Native touch,
keyboard navigation, scrollbar dragging, editable controls, zoom gestures and
reduced-motion preferences keep their browser behavior and interrupt inertia.
Animations stop when the target disappears or the document is scroll-locked.
The animation loop runs only during a gesture; cleanup is StrictMode-safe.

Use `data-lenis-prevent` to opt a gesture-driven widget out of wheel smoothing.
Maps use `data-scroll-gesture-surface`: cards nested inside the map may scroll,
but wheel events reaching the map canvas remain map zoom/pan gestures. The
analytics graph also retains its own zoom controls. Lenis is the animation engine;
the capture listener only routes input so map-hosted portals still work when the
SDK stops bubbling wheel events.

Validation for the Lenis integration: `npm run build`, `npm run typecheck`,
`npm run lint` and `npm run architecture:check` pass (lint retains existing
function-size warnings). Interactive verification was unavailable: the supplied
browser could not connect to the local Vite server. Real-device touch, map zoom
and perceived wheel damping still require a manual browser check.

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
Route result cards render mode-specific normalized data without saving geometry
or rewriting schedule times. Walking shows total time and distance only. Transit
owns proportional journey bars, line/stop summaries and adjacent itinerary popups.
Driving shows total time/distance, the provider's route description (when supplied)
and an adjacent detailed-itinerary popup, without a proportional bar or
turn-by-turn preview. The normalized API has no road-by-road distance or driving cost fields;
the UI does not derive these from navigation instructions or invent estimates.

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
checks remain server-backed. Local and preview pages opened with `?debug=1` send
the token-debug marker; when the backend confirms debug guest access is enabled,
the shared billing summary reports unlimited usage and balance surfaces render
`∞`. Payment provider selection and checkout remain unchanged. Decorative foil
animations respect reduced motion.

## Landing visuals

The landing page owns its decorative Canvas and SVG illustrations.
`visuals/globeRenderer` draws the geographic data, `globeMotion` owns drag state
and automatic rotation/recovery, and `animateGlobe` coordinates observers and
playback. Pointer capture ends on release, cancellation, capture loss, window blur
or a hidden document. After four seconds without input, the globe returns to the
original view over 1.2 seconds and resumes its existing forward/rewind loop.
Mouse, pen and touch drag adjust longitude only; the presentation tilt stays
fixed. Recent horizontal drag velocity drives a bounded, exponentially damped
coast on release. Cancellation, stale releases, blur and reduced motion suppress
coasting. A new drag cancels inertia and recovery immediately. Automatic forward
rotation accelerates toward the existing cruise speed; elapsed-time integration
keeps coast and acceleration independent of render frequency. Vertical touch
scrolling remains native. Reduced motion stops automatic playback, and pausing
an offscreen or hidden canvas clears residual velocity.

`components/PlanningPreview` owns per-preview viewport/document visibility. Its
SVG animations are defined in `styles/landing/planning-animation.css`, imported
after layout styles. Seven-second schedule, route and optimization stories pause
offscreen and show their static completed illustrations with reduced motion.
All observers, animation frames and input listeners are released on unmount.

## Optimization setting companions

`route-optimization/ui/OptimizationDaySelector` renders one current-day trigger
and a bounded, vertically scrolling day list. The list is portaled to a host in
the same dialog, outside the settings body's clipped scroll area. The
`useOptimizationDayPopover` UI hook measures the settings card, positions the
chooser to its left when space permits, clamps it inside compact viewports,
and handles resize, scroll and outside-pointer listeners. The selector owns
keyboard navigation and focus return; the modal owns the selected day and clears
stale request errors when selection changes. Per-day settings remain in
`useOptimizationModal`.

`OptimizationValidationPanel` separates server `severity=warning` and
`severity=error` into counted tabs. Local input and request failures belong to the
error tab; unknown-hours diagnostics belong to warnings. Tabs use roving focus,
arrow/Home/End navigation and an accessible panel, reset when the Day changes, and
keep the chosen category while results refresh. `blocks_optimization` remains
independent of the selected tab and severity. Existing localized labels and
issue/resolution keys are reused.

The settings dialog owns all three surfaces within one modal focus boundary.
`route-settings-companions.css` reserves desktop space on both sides, places the
day list on the left and validation on the right, and uses the map-overlay shadow
token. Settings size to their content up to `--route-settings-panel-height`
(680px, clamped to viewport height minus 48px); the body does not grow to fill
unused space above the action footer. Desktop validation uses size containment
and grid stretch to match the settings top/bottom edges without its issue list
increasing the row height. Its fixed width is 468px, 30% wider than 360px.
Both headers and settings actions stay fixed; only overflowing bodies scroll.
The day list has an explicit content-based height capped at 400px and the viewport
height; its Radix scrollbar remains visible whenever the list overflows. Arrow,
Home and End navigation scroll only the focused option into view. The portal
retains the dialog focus scope and blur checks include both the trigger and list.
Narrow layouts overlay the day list on the settings surface and stack the same
bounded validation panel below it, with outer scrolling to reach both panels.
Transparent gaps remain backdrop click targets.

## Trip picker preview resources and route card scrolling

`TripPreviewPool` owns one picker-session resource pool. A shared viewport observer
registers only nonempty `TripMapPreview` cards. `model/tripPreviewPool` assigns
visible cards to stable slots, reusing offscreen slots before creating a new one.
The pool grows to the peak simultaneously visible card count, rather than the
number of trips scrolled past. Stable React portal hosts move between cards while
their `GoogleMap` instances stay mounted. Idle slots detach their DOM and unmount
`TripPreviewContents`, releasing markers, lines and resize observers. Closing the
picker releases every map and the pool observer/frame. No Google imagery is
screenshotted, persisted or sent through a new API. Map attribution stays visible.

`TripPreviewContents` owns only geographic overlays and bounds fitting. The
preview host CSS remains in `styles/trip-maps.css`; no global map runtime changes
are needed. Empty trips retain the placeholder and create no map slot.

`RouteSettingsPanel` is a constrained flex column for both map pins and layer
detail cards. Endpoints and mode controls do not shrink or scroll vertically.
Only `.route-settings-body` scrolls; its minimum height is zero, overflow is
contained, and its keyboard focus ring stays inside the card. A mode/endpoint
change replaces the body so its scroll position returns to the top. The outer
card clips its content instead of introducing a second vertical scrollbar.

## Fixed map detail cards and route companions

`--map-detail-card-height` sets the preferred 600px height for saved-place cards
and route panels. Geographic and sidebar placement still supply the available
maximum height, so short viewports clamp the card. The saved-place group owns the
height; its shell fixes the header and `.trip-place-card-scroll` owns overflow.
Opening hours, visit timeline, memo and place information remain in that body;
the separate preferred-stay-duration section is no longer rendered. Stored
duration values and the time-range command/controller contract remain intact.
The Google search-result place card keeps its existing layout.

Route panels use the same height token with fixed endpoints/mode controls and
a scrollable results body. `RouteResults` displays the first five transit routes
in provider order; walking/driving route counts and upstream requests are unchanged.
Driving/transit detail buttons open `RouteDetailPopover` instead of expanding a
row. This body portal escapes the main card's overflow, uses the shared map
shadow token, and positions to the right or left of the main panel with a
viewport-clamped overlay fallback. Its header stays fixed while details scroll.
`routeDetailPlacement` observes card/anchor placement, resize and scrolling and
releases listeners, observers and frames on unmount. Closing or switching the
parent mode also removes its companion. Outside-pointer dismissal preserves the
new click target; explicit close/Escape restores the trigger's focus. The popup
uses the sidebar interactive-popover marker to preserve the parent detail card.

## Independent route validation

`shared/schemas/routeValidation` defines the independent `/validate` wire contract.
The current visit order and any requested service-start times are separate from
optimization endpoint/order preferences. `TrouteClient.validateRoute` checks both
request and response schemas, preserves cancellation through its existing HTTP
transport, and respects the external API policy. The backend gateway exposes
`/api/troute/validate` without entering optimization billing, Job mirrors or SSE.

`route-optimization/model/routeValidation` builds a detached read-only request from
the current day. It collects local input issues before routing and retains missing
opening-hours diagnostics. `useRouteValidation` debounces requests by 350 ms,
aborts on changes/close/submission and hides results whose fingerprint no longer
matches. Failed checks remain explicitly unverified and have a retry action.
Current clock times can use minute precision; optimizer-specific ten-minute
restrictions still apply to optimization inputs where previously required.

The right companion panel renders all reported issues, relevant facts and available
suggestions. Input errors can disable optimization; current-order/time conflicts
cannot. Validation does not enter the trip command path or save predicted times.
The current app request uses local Euclidean travel-time estimates, matching its
optimization request, and identifies that basis alongside warnings. Unknown
opening-hours data remains a visible warning instead of being presented as known.

## First performance pass

Localization has four explicit language module boundaries under
`shared/i18n/languages`. The config waits for the persisted language and English
fallback before dependent modules evaluate, preserving synchronous `L()` callers.
Other language chunks load before `changeLanguage`; stale concurrent switches are
ignored. Production JSON snapshots and development override precedence remain
unchanged. `build/localizationPreload` injects HTML hints for only the selected
language and English so the split does not add a module-discovery round trip.
Billing plans use a lazy boundary at the existing provider-owned open state.

`shared/api/inflightRequests` shares unfinished transport work and owns consumer
reference counts. Aborting one consumer leaves other callers active; the last
consumer aborts the transport. Entries are removed after success, failure or final
cancellation. Authentication keys work by session revision, and responses from an
old revision read the new session rather than publishing old account data. Place
detail keys include the complete normalized request, including locale and session
token. Completed responses, private account data and Places data are not cached.

`ai-chat/model/chatStreamBuffer` publishes bounded snapshots at 50ms intervals.
The authoritative completed answer still enters the existing thread workflow.
Timers stop on cancellation and unmount; request IDs reject superseded updates.
Completed message/Markdown views are memoized, and draft callbacks remain stable.
`useChatPersistence` debounces the existing v1 session snapshot by 300ms and flushes
on session disposal, pagehide and document hiding without flushing every keystroke.

The production frontend Caddyfile enables gzip/zstd, serves existing hashed assets
with a one-year immutable policy, and revalidates HTML/SPA responses. Missing asset
URLs return uncached 404 responses instead of a cached HTML fallback. API/SSE edge
routing and private API cache policies are unchanged.

### Opening-hours coverage and end-of-day windows

`entities/place/model/openingHoursSchedule` selects the schedule for the visit's
local calendar day. New Google snapshots retain `fetchedAt`, so current hours are
used only within their seven-day coverage; other dates use regular weekly hours.
Legacy snapshots without a timestamp use their explicit period dates where
available. Missing `periods` means unknown, whereas an explicit empty array means
closed within the applicable coverage. An explicit closure takes precedence over
regular all-day hours. The fetched `openNow` flag cannot override the requested
date's calculated status.

Unknown or all-day hours use `00:00`–`23:59`, matching troute's end-of-day closing
exception. A same-day window ending at midnight maps to `23:59`; overnight windows
remain unsupported. Detached validation rounds only the derived arrival/start
down to the ten-minute API grid while preserving exact requested service times.

## Workspace command console

`map-workspace/command-console` owns the Ctrl+K parser, completion, bounded output
history and scoped command registry. The shared workspace command schema is the
source of argument contracts for console text and AI proposals. Catalog handlers
are page-scoped; editable commands are TripSession-scoped. Viewport composition
connects existing camera, file, optimization and place workflows. All trip writes
continue through TripEditController. `CommandOutputView` receives records and
execution callbacks; it does not resolve services. See
[workspace-command-console.md](workspace-command-console.md) for syntax and limits.
The quick-search stylesheet keeps its existing import point and uses the shared
map overlay shadow token.

## Immediate Google place popup

`GooglePlaceCard` renders its shell as soon as a map POI is selected. Loading,
success and failure share `--map-detail-card-height`, a fixed header and a
scrollable content area. Its feature CSS defines the title/body skeleton pulse
and respects reduced-motion preferences; the shell keeps the shared map shadow.
The popup remains anchored to the original click throughout the request.

`useSelectedGooglePlace` exposes retry for the failed selection through workspace
actions. Retry uses the same cancellable selection path as a new click; closing,
switching places or unmounting still prevents an obsolete response from reopening
the card. No completed Places responses are cached.

## Layer rendering pass

Each editable/read-only workspace owns an `entities/trip` view mapper. Weak caches
reuse conversions of immutable store days, places, routes and arrays; unchanged
view objects survive edits elsewhere and persistence timestamps do not invalidate
the sidebar view. The one-off `tripToView` export still creates an isolated view.
Do not mutate either a store snapshot or a reused view object.

Day sections keep their headings and hidden list shells for accessibility and
reorder targeting, but mount list contents only while expanded. The shared layer
resolver indexes places, place positions and route endpoints once per expanded
day instead of looking them up for each row. Day memoization scopes selection and
validation comparisons to that day's items, while comparing all other props,
including callback identities. Existing memoized place/route rows receive reused
objects and scalar state. Detail lookup stops at the requested item and does no
work when no detail card is open.

`shared/lib/useEventCallback` keeps UI forwarding callbacks stable while updating
their implementations after commit. It is for event handlers, not reactive effect
logic. Row selection, detail opening, focus forwarding and reorder handlers use the
latest committed data. Hidden-day drop positions come from current domain places,
since an unmounted list no longer contains rows to count; header-hover expansion
and the existing pointer/keyboard reorder workflow remain in place. Collapsing a
day clears its editor ownership so reopening does not revive a removed editor.

The editable workspace subscribes to trip data rather than the whole persistence
state. `TripSaveStatus` owns the save status/time subscription at the header leaf;
card/overlay composition subscribes separately to the error string through
`useTripError`. Dirty/saving status-only notifications do not invalidate the map
workspace or viewport. Editing, history and autosave still use the existing
command/controller path.

## Tutorial positioning and copy

`features/onboarding/ui/trackTutorialLayout` tracks the active DOM element's
viewport bounds and the popover size while the guide is mounted. It asks Driver
to refresh the spotlight, popover and arrow only when geometry changes, after
Driver's step animation finishes. This covers asynchronously loaded trip cards,
container layout changes and scrolling without restarting a step or writing
progress. Cleanup cancels the animation frame when the guide unmounts.

The six tutorial titles/descriptions and finish/leave labels use dedicated
`common:tutorial.*` keys. Their source is the localization spreadsheet's `common`
tab, rows 68–81; general feature descriptions are not tutorial instructions.

## Product surface refinement

The theme owns shared panel typography, control sizes, radii, dividers and header
tint. Feature styles consume those tokens for map cards, route companions,
sidebar, search and AI chat. The central map surface/shadow tokens apply to both
light and dark mode. `MapPopupCardShell` delegates close controls to `IconButton`.
Map placement and feature-specific height constraints remain with their owners.

Popup entry only changes opacity, leaving measured geometry stable. Selected
markers, layer rows and tools share blue emphasis while retaining Day colors.
See [product-surface-guidelines.md](ui/product-surface-guidelines.md) for values,
interaction states and ownership.

## Shared Radix scroll areas

`shared/ui/ScrollArea.tsx` owns the Radix Scroll Area integration and the themed
thumb/track CSS. Root owns placement and sizing, Viewport owns native scrolling,
and Content owns flex/grid spacing and padding. Radix's explicit Content API
keeps measurement separate from the existing semantic `ul`/`ol` lists. Viewport
refs and scroll/touch/wheel handlers retain chat pinning, selected-item reveal
and layer drag auto-scroll. Absolute dropdown placement remains CSS-owned.

The shared component is used by editable/read-only layer lists, place details,
side details, route results/steps/mode tabs, optimization settings/day selection/
validation/progress/previews, trip picker, sharing, command console, place search
and both chat versions. Headers, input bars, footers and existing popup height
constraints stay outside their existing body scroll areas. Native form controls,
document scrolling, code blocks and third-party/development screens use a CSS
fallback with the same existing theme scrollbar tokens. No map SDK DOM is
rewritten and no wheel/touch scrolling is simulated.

## Neutral surface refinement

Theme import order is `light-and-tokens.css`, `dark-theme.css`, then
`refined-surfaces.css`. The final file overrides semantic colors, floating
shadows and radii while retaining the original Primer tokens and compatibility
aliases. Theme switching still sets `data-theme` on the document root.

Use `--color-accent`/`--color-primary` for filled actions and
`--color-accent-foreground` for small accent text and icons on neutral/tinted
surfaces. Filled controls keep white labels; the dark foreground accent is a
lighter blue. Primary/secondary/muted text retain distinct readable contrasts.

Panels use `--color-map-overlay-surface`; compact search, quick-search and
token-balance controls use `--color-map-control-surface`. Both derive a 50%
opaque material from the active neutral theme via `--map-overlay-opacity`, with
a 24px backdrop blur on each floating surface. Header tints use 15% neutral
color; sidebar action strips, active Day headings and selected/hovered rows also
retain transparent backgrounds.
Unsupported backdrop filtering and reduced-transparency preferences receive
solid surfaces; reduced transparency also disables the blur. Map floating
surfaces continue sharing
`--shadow-map-overlay`. The neutral palette does not alter user-selected layer,
marker or route colors, nor the fixed billing/optimization dialog dimensions.

## Layer actions

The editable day header uses `DayLayerMenu` for shuffle and deletion. Menus are
portaled to avoid sidebar scroll clipping; positioning and keyboard navigation
stay in the presentation layer. Both actions are available outside debug mode.
`DayDeleteDialog` lives in `LayerPanel`, so removing the originating row cannot
unmount a pending confirmation. Cancellation is the initial focus target.
`removeDay` enters the existing command/history/autosave pipeline and removes the
entire owning day, including its places, route segments and saved visibility.
Deleting the final layer is permitted by the existing trip schema and empty view.
Read-only layers keep their existing controls.
