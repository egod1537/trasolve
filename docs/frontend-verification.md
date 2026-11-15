# Frontend refactoring verification

## Change scope

The refactor preserves service routes, HTTP/persistence formats, localization keys,
Google-native markers, command-based editing, Undo/Redo, confirmed-batch recovery,
authentication and live/sandbox/debug billing separation. No state-management or DI
runtime framework is introduced. New development dependencies are dependency-cruiser
and its SWC parser. Large modules are divided by data contract, request lifecycle,
persistence policy and presentation responsibility. CSS entrypoints preserve cascade.

## Checks

Run from the repository root:

1. `npm run architecture:check`
2. `npm run typecheck`
3. `npm run lint`
4. `npm run build`
5. `npm run format:check`

The 400-line file budget is an error. Function-size limits intentionally report
warnings, including existing functions that are below the file limit. They remain
visible for review; they are not suppressed with per-file exceptions.

The stylesheet split was compared against the original top-level rule/declaration
sequence. No theme values, selectors, media conditions or declarations were edited.
The two public module boundaries detected during inspection were corrected:
sharing imports authentication through its public index and preferences imports
map locale status through its public capability module.

## Recorded static results

- Architecture: 459 frontend source modules covered, 1,830 dependencies, including type-only imports; no violations or cycles.
- Workspace and localization typecheck: passed.
- Lint and localization checks: passed with zero errors. The new function-size review policy reports 106 warnings; no file exceeds the 400-line error budget.
- Production build: passed for shared, backend and frontend.
- Formatting: every changed/new file passes. Full `npm run format:check` still reports five untouched baseline files: `frontend/src/features/auth/ui/LoginDialogProvider.tsx`, `backend/src/auth/authenticationService.ts`, `backend/src/auth/localAuthRepository.ts`, `backend/src/auth/postgresAuthRepository.ts`, `shared/schemas/troute.ts`. Their original HEAD contents were checked separately and fail the same formatting check. They were not reformatted as unrelated changes.
- CSS: parsed before/after comparison passed for all 12 split entrypoints, including nested rule/declaration order and values. Changed text files use LF; `git diff --check` passes.

## Manual browser scenarios

| Area                    | Scenarios                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Landing and preferences | Open/close login, navigate to map, switch locale/theme, keyboard focus and mobile layout                                          |
| Trip sessions           | Create/open, switch between trips, reload, save a rename, leave and reenter under StrictMode                                      |
| Editing                 | Add/remove, reorder days and places, memo/style/time edits, Undo/Redo, failed save and revision conflict                          |
| Maps                    | Marker identity, selection, pan/zoom, overlays, resize, route display and read-only share                                         |
| AI                      | Send, concurrent threads, draft switching, rename/archive, cancellation, unread state, persisted conversation and applying a plan |
| Optimization            | Validation, start/end/mode settings, cancellation, cache reuse, preview and confirmed application                                 |
| Billing                 | Trip-picker balance visibility, debug top-up, insufficient tokens and cancellation; live/sandbox isolation                        |
| Testbeds/admin          | Job builder, raw request editing, empty/offline/error states, stream reconnect and navigation                                     |
| Sharing/accessibility   | Read-only enforcement, focus return, Escape, keyboard timeline controls and four locales                                          |

## Environment limitation

During this refactor the local backend and Vite server started successfully, but
the available browser could not connect to the executor's loopback listener
(`ERR_CONNECTION_REFUSED`). Browser scenarios above remain unverified in this
checkout. Static checks and compilation do not replace those interactions.
Live Google Maps/Places/Routes, OAuth, GPT, Toss and PostgreSQL operations also
require the corresponding configured environment. Do not infer that those external
services were exercised from a successful frontend build.

## Layer visibility persistence

- Typecheck, architecture, lint/localization and production build passed for the
  visibility change. Existing function-size warnings remain visible.
- Manual HTTP requests against the real local backend verified creating and
  reopening a trip with omitted/true/false `hidden` values, saving every day as
  hidden, reopening after showing one day, and matching values in the trip list.
  The newly created verification trip was removed afterward.
- The optional field leaves legacy day objects unchanged and is accepted by both
  input and stored trip schemas. PostgreSQL stores those complete day objects;
  no database schema migration is required.
- The isolated Vite listener could not be reached from the available browser.
  Browser verification of the eye toggle, mixed state, keyboard activation,
  Undo/Redo, hidden selections/details and read-only viewing remains pending.
  No Google Maps credentials or PostgreSQL connection were configured here.

## Route, dialog and itinerary export update

Implementation checks cover shared route-card composition, all returned
alternatives, cancellable loading, empty-layer imports, departure-time input,
current-balance gauges and plan-dialog presentation. No unit/integration fixtures
or mock API/SDK branches were introduced.

Manual follow-up scenarios:

- Open the same connection from a layer and the map; compare mode tabs, result
  cards, journey colors, errors and expanded instructions. Switch quickly between
  endpoints and close while loading; only the current request may publish.
- Click a saved or Google marker with uncached details. The complete card appears
  after success/error, and the marker remains visible. Check repeated selections.
- Add/remove the last place in a layer and confirm import-link visibility.
- Scroll many day chips; switch departure policies, preserve the fixed-time draft
  and verify it is disabled for earliest/latest and during submission.
- Verify the plan-header balance/debug badge, foil animation, reduced motion,
  debug checkout and insufficient-balance actions in both purchasing tabs.
- Export KML/KMZ and select PDF itinerary. The latter opens an A4 print document;
  choose Save as PDF in the browser. Verify Korean, dates, long names/memos,
  empty days, page boundaries, selectable text and Maps links.

Browser execution in this workspace is constrained: headless Chromium cannot
create its process-singleton socket, and the cloud browser blocks local file
previews. Live map/payment interactions and browser PDF-save behavior therefore
remain unverified; successful static checks are not evidence of those flows.

## Landing globe and planning animations (2026-11-11)

- Implemented mouse/pen rotation and tilt, horizontal touch rotation with native
  vertical scrolling, four-second idle recovery and the existing automatic loop.
- Planning SVGs show sequential schedule cards, route drawing and before/after
  optimization on seven-second cycles. Per-preview viewport and document
  visibility pause playback; reduced motion shows static graphics.
- Static validation: architecture check, workspace typecheck, lint/localization,
  workspace build, formatting and diff whitespace checks passed. Lint retains
  function-size warnings, with no errors.
- Visual validation is pending: local Chromium cannot launch because the runtime
  denies its process-singleton socket, and the available browser cannot connect
  to the local Vite server (connection refused). No UI verification is claimed.
- Manual checks when a browser can reach the build: drag outside the globe and
  release; cancel a touch gesture; interrupt recovery with another drag; confirm
  idle recovery and subsequent rewind; scroll the previews out of view and back;
  switch tabs and reduced-motion preference; check mobile vertical scrolling.

## Optimization day selection and validation companions (2026-11-11)

- Replaced the horizontal day strip with a single current-day selector. The left
  popover supports long names, bounded vertical scrolling, selected-item focus,
  Arrow/Home/End navigation, Enter/Space selection, outside dismissal and Escape
  dismissal without closing the settings modal. Selection returns focus to the
  trigger; moving focus out closes the list.
- Moved the existing validation issue and retained request errors into an automatic
  right companion panel, including localized issue explanations and resolutions.
  Existing issue, affordability and in-flight guards remain authoritative. Day
  and setting changes still clear stale request errors. Valid input removes the
  validation panel without introducing an in-card status button.
- Responsive CSS reserves desktop side columns, overlays the selector list when
  there is insufficient horizontal space, and stacks validation below settings
  on narrow screens. Long day lists and validation content have bounded scrolling.
- Workspace typecheck, architecture, lint/localization and production build passed;
  changed-file formatting and LF/whitespace checks passed. Existing function-size
  warnings remain. No automated test files or mock branches were introduced.
- Interactive verification remains unavailable: Vite served on 127.0.0.1:5173,
  but the supplied browser returned ERR_CONNECTION_REFUSED for the local URL.
  Manual follow-up: many/long/empty days, switching an invalid day to a valid one,
  keyboard selection and Escape/focus return, outside/backdrop clicks, narrow and
  short viewports, and failed-run details after closing the progress dialog.

## Mode-specific route result cards (2026-11-11)

- Walking results show total duration/distance and their route-selection control,
  without journey bars, instruction previews, fare or expanded step lists.
- Driving results show total duration/distance, a provider-supplied route
  description when available, and a collapsed detailed itinerary. No journey bar
  or first-three-maneuvers preview is rendered. Blank descriptions omit the row.
- Transit keeps its proportional walking/riding bar, line/stop overview, actual
  fare if supplied and expandable itinerary. No new API calls or saved-trip
  mutations are introduced.
- Road-level distances, traffic badges and driving price breakdowns are not
  supplied by the normalized contract; they are not fabricated or parsed from
  localized navigation prose.
- Browser checks remain pending in this environment: local Chromium process
  sockets are denied and the available browser cannot reach the local server.
  Check both map-anchored and layer detail cards, alternative route selection,
  blank/long road descriptions, walking-only and mixed transit itineraries,
  narrow screens and read-only shared maps against real provider data.
- Static validation passed: workspace typecheck/build, architecture check,
  lint/localization (no errors; existing function-size warnings), formatting,
  whitespace and LF checks.

## Pooled trip previews and fixed route headers (2026-11-11)

- Replaced one-map-per-visited-card retention with a picker-session slot pool. A
  shared observer assigns visible nonempty cards to reusable map hosts. Slots
  preserve GoogleMap instances while changing trips; offscreen slots detach and
  release overlays. Pool size follows peak simultaneous viewport demand.
- Kept real map backgrounds, geographic markers/lines, bounds fitting (including
  the antimeridian), attribution links, empty-state placeholders and card actions.
- Fixed route popups by making endpoints and mode controls nonshrinking header
  rows and moving overflow into one bounded results body. Mode changes reset its
  scroll; keyboard focus and native/smooth wheel targeting use that body. Both
  map-anchored and sidebar route cards share this layout.
- No screenshots, image caches, new credentials or external API endpoints were
  introduced. No measured performance improvement or live UI check is claimed.
- Manual follow-up when the runtime can open the service: scroll through many
  trips and back, resize across the one/two/three-column breakpoints, refresh or
  delete trips, switch map theme, close/reopen the picker, and inspect GoogleMap
  instance/overlay counts. Confirm a fixed map-count high-water mark during
  same-size scrolling and complete disposal when the picker closes.
- For route cards, open long transit alternatives/details in short viewports,
  scroll results, switch travel modes, tab to controls and resize/reposition the
  map pin. The mode selector and close button must stay visible with one results
  scrollbar and no outer vertical scrollbar. Browser execution remains blocked
  by the previously recorded local process/socket and browser-network constraints.

Static validation for this change passed: workspace typecheck, production build,
frontend architecture, lint/localization (no errors; function-size warnings),
repository formatting and diff whitespace checks. Changed text files use LF.

## AI chat V2 (2026-11-11)

- Added the Open WebUI-inspired React panel behind `opts.useChatV2` (default on),
  upper-right balance gauge, empty-state actions, stop/copy controls, collapsible
  progress/public summaries and latest-answer follow-up chips. Existing history,
  request cancellation, unread previews, Markdown download and trip-plan actions
  use the shared thread/controller contracts.
- Static checks: workspace typecheck, workspace build, lint/localization and
  architecture check pass. Existing function-size warnings remain; no lint errors.
- Manual HTTP checks against the real development server and its existing random
  provider: authenticated SSE emitted status/status/complete; balance changed from
  2000 to 1990 once. Disconnecting a second request before completion left the
  balance at 1990. An unauthenticated streaming request returned HTTP 401.
- The runtime has no configured production OpenWebUI credentials. Real upstream
  text/summary deltas and model-generated follow-ups remain unverified. Nonstream
  providers intentionally do not simulate token-by-token output.
- Browser verification is blocked: the available browser cannot connect to the
  locally running Vite server (ERR_CONNECTION_REFUSED). Layout, narrow/mobile
  widths, focus, theme, IME, scroll retention and live trip application need a
  manual check where the browser can reach the build. No visual QA is claimed.

## Fixed detail heights and route companion popups (2026-11-11)

- Saved-place and route cards use a common 600px preferred height, clamped by
  their anchor/sidebar placement's available maximum height. The outer height
  stays stable across short/long content and mode changes within that space.
- Removed the separate preferred-duration UI from saved-place detail content.
  Opening/visit timelines, memo editing, links, deletion and style controls remain;
  stored duration values and shared time-update commands are unchanged.
- Added an internally scrolling saved-place body below its fixed header. Route
  endpoints and mode selection remain above their existing bounded results body.
- Transit results display at most five alternatives in upstream order. Driving
  and walking counts and API requests are unaffected.
- Driving/transit step details now open a separate body-portal popup with its own
  fixed header and scroll body. Right/left placement falls back inside the viewport
  on narrow screens. Outside click, Escape, explicit close, trigger toggling,
  parent closure and mode changes remove it. Explicit dismissal restores focus.
  Sidebar outside-click handling recognizes it as an interactive child popup.
- Manual follow-up: compare empty/short/long memo and missing/available opening
  hours; edit the visit timeline/memo; open business hours and deletion; resize
  and reposition pins; confirm at most five transit cards; open/switch/close
  route companions in map and sidebar views, including narrow/short windows.
- Live UI remains unverified because the previously recorded browser-network
  and local Chromium socket restrictions prevent opening the running service.

Static validation passed: workspace typecheck/build, frontend architecture,
lint/localization (no errors; existing function-size warnings), formatting and
whitespace checks. Changed text files use LF.

## Standalone itinerary validation integration (2026-11-11)

- Connected the real troute `POST /validate` endpoint through
  `POST /api/troute/validate`, with strict shared schemas, body bounds, upstream
  timeout/policy handling and abort propagation. No fabricated validation response,
  optimization charge, Job mirror or SSE subscription is introduced.
- The frontend sends current order, mode, opening/stay constraints and existing
  pinned visit times. It collects local blocking inputs, retains missing-hours
  warnings, debounces changes, suppresses stale results and exposes retry on
  unavailable validation. Valid current-plan conflicts remain warnings and do not
  disable optimization; schema/domain input errors can block it.
- Actual HTTP verification started both real servers in the same network namespace.
  A pinned-time/window conflict returned three issues through both endpoints with
  `blocks_optimization=false`; a corrected plan returned no issues; malformed
  domain input returned `blocks_optimization=true`. The troute Job list stayed empty.
- Workspace typecheck/build, architecture, lint/localization, changed-file
  formatting and LF/whitespace checks are run for this change. The troute repository
  additionally runs its Rust tests and clippy. No automated test files or mock
  branches were added to Trasolve.
- Browser interaction remains unverified because the supplied browser cannot reach
  the executor's local listener. Follow up with rapid Day/mode/time changes,
  close/reopen during an in-flight check, retry, warning-only execution, unknown
  hours, multiple problem cards, and narrow/short viewport scrolling. Real provider
  routing, payment and deployed-server compatibility were not exercised locally.

## First-use tutorial (2026-11-11)

- TypeScript checking, production build, lint/localization lint, architecture
  checks, formatting, and LF checks cover the onboarding addition. Existing
  function-size warnings are retained.
- Manual requests to a real locally bootstrapped backend verified two distinct
  authenticated accounts start independently, saving completion affects only the
  current account, a fresh repository reload retains completion, and resetting
  returns to `not-started`.
- The actual HTTP endpoint returned 401 without authentication, 403 for a
  mismatched account header and cross-site writes, and 400 for invalid steps or
  unsupported write versions. No fake repository, SDK, or API response was used.
- Interactive browser verification was unavailable: the browser runtime could
  not connect to the local application. Before release, check actual creation
  success/failure, Day addition, all six highlights, keyboard navigation and
  close/skip, reload/resume, replay without changing completion, debug
  `auto`/`always`/`off`, reset, switching accounts, and mobile popup placement.
- PostgreSQL persistence uses existing `users.settings` and has type/build
  coverage; a live PostgreSQL connection was not available in this environment.

## Severity tabs and tutorial actions (2026-11-11)

- Validation uses separate counted warning/error tabs. Server severity controls
  grouping; local input and request failures are errors, and unknown opening
  hours remain warnings. A selected empty category has an explicit empty state.
  Tab switching preserves the independent optimization-blocking flag, supports
  keyboard navigation, resets content scrolling, and resets selection per Day.
- Settings and validation use one 680px preferred fixed height, clamped by the
  viewport, with matching desktop top/bottom edges, fixed headers/tabs/actions,
  and internally scrolling bodies. Narrow screens stack bounded panels.
- Tutorial version two covers creation, adding a layer, search, adding a place,
  optimization and AI. Seoul Station is searched through real autocomplete with
  a local location bias. Continuing from search selects a matching station type;
  only successful place addition advances to the optimization introduction.
  Search/details failures keep the original error and retry path. No synthetic
  Google response or automatic optimization/chat submission is introduced.
- Version-one progress remains readable and restarts the new sequence. Skipped
  and completed progress is guarded against delayed action callbacks.
- Manual requests to the real local backend confirmed version-two defaults,
  reading a stored version-one `share` marker, saving `add-place`, completing `ai`,
  and durable reload. Old-version writes and version-two `share` writes returned
  HTTP 400 rather than downgrading the current marker.
- Validation uses workspace typecheck, build, lint/localization, architecture,
  formatting and LF/whitespace checks. Live browser layout, keyboard/click behavior
  and credentialed Google Places lookup remain unverified in this runtime.

## Unlimited debug tokens (2026-11-11)

- Local and server-enabled debug preview pages request unlimited sandbox tokens
  only with `?debug=1`. Live wallets keep the original metering. Server policy
  can authorize or reject the marker through
  `TRASOLVE_DEBUG_UNLIMITED_TOKENS=auto|true|false`.
- Manual HTTP checks against the real development server returned
  `unlimited: false` and chat cost 10 without the marker, then
  `unlimited: true` and zero chat/optimization costs with it. Direct policy
  checks returned metered sandbox usage without the marker, unlimited sandbox
  usage with it, and metered live usage in both cases.
- Invalid Origin still returned 403 `PAYMENT_FORBIDDEN` in unlimited mode.
  Token request IDs, authentication and Origin validation remain enforced. This
  policy removes balance limits; it does not resolve an unrelated Origin error.
- The Vite 8 development proxy preserves the browser `Host` during `/api`
  forwarding. Real proxy requests from both `127.0.0.1:5173` and
  `localhost:5173` advanced past Origin validation; the diagnostic unknown
  billing route returned its expected 404 instead of the previous 403.
- Typecheck, build, architecture and lint/localization checks passed. Browser
  visual verification remains unavailable in this workspace as documented above.

## First performance pass (2026-11-11)

Baseline: `958a06d`, production build in this workspace. Byte counts below sum
emitted initial JavaScript dependencies with the same gzip calculation; they do
not measure LCP, INP, frames per second, CSS, fonts or the external Maps SDK.

| Initial JavaScript                                  |    Before |   After |
| --------------------------------------------------- | --------: | ------: |
| Raw bytes, including Korean and English fallback    | 1,027,252 | 792,933 |
| Gzip bytes, including Korean and English fallback   |   309,570 | 246,636 |
| Static dependency gzip bytes before language chunks |   309,570 | 188,092 |

The comparable startup gzip estimate falls about 20.3%. The language-independent
i18n chunk is about 52KB raw instead of 467KB; the two initial language chunks are
included in the startup totals above. Other languages and the plans dialog are
separate lazy chunks. HTML preloads start the two selected language downloads
before i18n module evaluation discovers them.

Manual execution evidence:

- Vite's real module loader initialized Korean, Japanese, English and Mongolian;
  all 11 namespaces loaded and the cancel label localized for each language.
- The request coalescer called the actual local backend authentication API once
  for concurrent consumers. Aborting one caller preserved the other response;
  completed responses were fetched again, and an abandoned key could be reused.
- Direct stream-buffer execution fed 100 text events before the first timer:
  one snapshot contained all 100 characters. Cancellation prevented a later
  queued publication. This is a buffer check, not a live model performance result.
- A real local Caddy 2.11.9 process served a build asset with gzip and immutable
  cache headers, a `/map` SPA response with `no-cache`, and a missing chunk with
  HTTP 404 and `no-store`. The repository's Caddy 2.10 container was not launched.
- Workspace typecheck/build, architecture, lint/localization (zero errors,
  existing function-size warnings), changed-file formatting and whitespace/LF
  checks pass. No test files, mock APIs or new dependencies were added.

Browser interaction remains unverified: the available browser cannot connect to
this executor's local listener. Follow up with persisted-language reloads and
switches, first plans opening/payment callbacks, long streaming conversations,
IME input, drafts after close/reopen/navigation, and simultaneous place selection
with one consumer cancelled. These changes do not claim measured device-level
rendering or loading-time improvements from the bundle result alone.

## Missing opening hours and calendar coverage (2026-11-11)

- Manual calls to the actual opening-status, optimization-request and detached
  validation modules confirmed unknown/missing periods use `00:00`–`23:59`, a
  missing current period list uses regular hours, and future dates outside a
  stamped current snapshot use weekly hours. Explicit empty periods still block
  as closed, including when regular hours say always open.
- Current-only always-open data and a same-day midnight closing are accepted;
  a true overnight window remains a local input issue. Shared request schemas
  accept the resulting end-of-day windows. Minute service times are retained
  while the derived validation arrival is rounded down to ten minutes.
- Actual local troute HTTP calls with requests from these modules confirmed a
  latest-start route can run from `23:24` through `23:59`; detached validation
  returned a feasible plan, preserved minute service times, and accounted for
  waiting after the rounded arrival. An ordinary `23:55` closing time remained
  invalid. Supplied matrices avoided provider calls.
- Typecheck, production build, frontend architecture and lint/localization checks
  passed. This is request/calendar logic verification; browser visual checks
  remain unavailable as documented above.

## Workspace command console (2026-11-11)

- Typecheck, production build, lint/localization lint, architecture, changed-file
  formatting and LF/diff checks cover the registry, scoped handlers and UI wiring.
  Existing function-size warnings remain; no automated test files were added.
- Direct manual execution of the real tokenizer/parser checked quoted Korean
  arguments, escaped quotes, optional selected-place arguments, inline options,
  invalid prefixes, duplicate/unknown options, invalid ranges and unfinished
  quotes. Catalog message packing stays within the 4000-character chat limit.
- Browser interaction and live Places/Routes/AI requests remain unverified because
  the supplied browser cannot connect to the local application. Before release,
  check keyboard/focus/IME and small viewport scrolling, all UI handoffs, actual
  search/add and route alternatives, AI proposals and stale rejection, optimization
  preview/apply, cancellation, undo/redo/autosave and trip-switch save failures.

## Immediate Google place popup (2026-11-11)

- Typecheck, production build, architecture and lint/localization checks passed
  (lint has existing non-blocking warnings). Loading and retry use existing
  localized strings; no translation resources or Google Sheets were changed.
- Reviewed the pending/loaded/error render branches: the popup shell and close
  button remain mounted, skeletons have a localized status announcement, and
  failure exposes retry. Request cancellation and stale-response guards remain
  shared with ordinary selection. The anchor and outer height are independent
  of the returned details, with internal scrolling for constrained map space.
- Browser visual verification could not run: the browser could not connect to
  the local development server. Before release, manually check a slow Places
  response, failure/retry, closing before completion, rapidly switching pins,
  long names, short/mobile viewports and reduced motion.

## Layer rendering pass

Direct execution with Vite's real module loader, React's server renderer and the
existing Seoul demo data verified these rendering/data properties:

- The three-day demo contains 15 places. With the first day expanded, editable
  and read-only sidebars each emit three place rows; the editable sidebar emits
  two route rows. With every day collapsed, place/route rows are both zero and
  the three hidden list shells remain for accessibility and drag targeting.
- The same rendering check with 20 days and 60 places emits only the expanded
  day's three place rows in both modes, and zero place/route rows when collapsed.
- Editing one place through the immutable store replaces that place's view but
  preserves another place in the same day, an unchanged day and an unchanged
  route. Status-only changes and a later persistence timestamp preserve the
  sidebar view. Independent mappers do not share mutable view objects; changing
  the undated-period label updates the view, and input conversion is preserved.
- The day comparator skips selection changes outside the day, reacts to selection
  inside the day and never ignores changed callback identities. Resolved route
  endpoints match the actual place objects.

Workspace typecheck/build, architecture, lint/localization and changed-file
formatting/whitespace/LF checks pass. Lint retains existing function-size warnings and a pre-existing chat hook
dependency warning, with zero errors. No
test files, test-only application branches, mocks or dependencies were added.

This is render-output/reference verification, not browser frame-time measurement.
Local headless Chromium cannot start because its Unix socket creation is denied;
the connected browser also cannot reach the executor's local listener. Before
release, manually verify fold/reopen, inline name editing, selecting/focusing items,
Shift/Ctrl selection, hidden-day drops before and after hover expansion, pointer
and Alt+Arrow reordering, undo/redo, and save failure/recovery in a normal browser.

## Tutorial copy and anchor tracking (2026-11-11)

- Replaced all six titles/descriptions with action-specific tutorial copy,
  including searching Seoul Station, adding it to the created layer, and using
  the finish/leave controls. Registered 14 dedicated keys in `common!A68:G81`
  of the configured localization spreadsheet with ko/ja/en/mn translations.
  Connector readback verified every written value and preserved row formatting
  and the existing TODO/TRANSLATED/REVIEWED status validation.
- The standard production sync command cannot authenticate here because
  `GOOGLE_SERVICE_ACCOUNT_JSON` is unavailable (the tsx CLI also cannot create
  its IPC socket). Retrieved the live common tab through the connected Sheets
  API and ran the repository's existing resource generator/writer through
  `node --import tsx`. Only the four generated common snapshots are changed;
  other namespaces are preserved. No production JSON was authored by hand.
- The guide now checks actual element bounds and popover dimensions while
  mounted, refreshing only on geometry changes after Driver's transition.
  The frame loop is cancelled on cleanup and does not restart steps or write
  tutorial progress.
- Workspace typecheck, build, architecture check, lint/localization lint,
  changed-file Prettier, whitespace and LF checks pass. Existing unrelated
  lint warnings remain; there are no errors. No automated tests/mocks added.
- Browser visual verification remains pending in this environment. Manually
  check slow trip-list loading, popup resizing, scrolling and mobile layout;
  the spotlight, arrow and description must stay attached to the active control.

## Settings spacing and validation width follow-up

- Settings now use content height with a viewport-clamped maximum; the body no
  longer expands to create blank space above the optimization action footer.
- Desktop validation follows the settings height with size containment and grid
  stretch. Its fixed width changes from 360px to 468px (+30%). Grid totals and
  responsive breakpoints expand accordingly; stacked panels restore an explicit
  bounded validation height without size containment.
- Workspace build/type compilation, lint, changed-file formatting and LF/whitespace
  checks pass. Browser layout remains unverified in this environment.

## Product surface refinement (2026-11-11)

- Workspace typecheck, production build, architecture check and lint/localization
  checks passed. Existing 113 non-blocking lint warnings remain. Changed-file
  source formatting, whitespace and LF checks pass; no tests, mocks, dependencies or
  localized strings were added.
- Reviewed shared close-button labels and focus semantics, pressed/expanded and
  disabled/busy button states, Day colors versus selection rings, and reduced
  motion coverage. Popup entry no longer scales or translates measured map cards.
  Billing's fixed non-scrolling layout, place-card heights and current route
  layout constraints are retained.
- A real local Vite server started successfully on `127.0.0.1:5173`, but the
  browser returned `ERR_CONNECTION_REFUSED`. The public service landing page was
  reachable; its editor requires authentication. New screen appearance therefore
  remains unverified. Before release, review light/dark, narrow viewports, long
  titles, keyboard focus, selected/drawing marker states, dropdowns, route
  companions, billing and both chat layouts with reduced motion on and off.

## Radix scrollbar styling (2026-11-11)

- Added the focused `@radix-ui/react-scroll-area` dependency and one shared UI
  component. Primary workspace panels and both chat versions use Radix overlay
  scrollbars; native surfaces keep browser scrolling with a matching CSS palette.
- Static review checked that chat `scrollTo`/pinning and sidebar drag/reveal refs
  still target the actual Viewport, semantic lists remain lists, existing flex/
  grid spacing lives on measured Content, dropdown absolute positioning is kept,
  and headers/actions stay outside their previous body scroll regions. Styling
  covers horizontal route tabs, both themes, reduced motion and forced colors.
- Typecheck, production build, lint/localization, frontend architecture, changed-
  file formatting, whitespace and LF checks cover the change. No automated test
  files, fake SDKs or API mocks were added.
- Interactive visual verification is blocked: Vite starts at `127.0.0.1:5173`,
  but the available browser reports `ERR_CONNECTION_REFUSED` for that address.
  Before release, verify hover/fade and thumb dragging, wheel/touch/keyboard
  scrolling, long/short and resized popups, small viewports, chat stream pinning,
  layer reorder/reveal, and light/dark appearance in the deployed application.

## Neutral surface refinement (2026-11-11)

- Added a final semantic theme layer for light and dark appearance: neutral
  backgrounds, distinct panel/nested-card luminance, softer shared shadows and
  rounded controls. Primer status meanings and existing theme preference remain.
- Reduced blue decoration and heavy text in search, the trip sidebar, pricing,
  tutorial popovers and optimization settings. Tutorial arrows retain an outlined
  edge matching the neutral popover border. Selection/focus indicators remain.
- Search/quick-search and the token balance retain a 92% solid material with a
  solid fallback. Long-form panels and AI previews are solid. Reduced transparency
  disables the material tint and backdrop blurs.
- Direct sRGB contrast calculation checks 24 combinations per theme: primary,
  secondary, muted and accent text against five neutral surfaces; white labels
  against normal/hover/active blue fills; and accent text against its selection
  tint. Minimum is 4.63:1 in light appearance and 4.70:1 in dark appearance.
  Input border contrast is at least 3.66:1 (light) and 3.57:1 (dark). These are
  token-pair checks, not a whole-application accessibility audit.
- Typecheck, architecture, lint/localization lint and production build pass.
  Changed CSS passes Prettier, whitespace and LF checks. Existing unrelated lint
  warnings remain. No dependencies, test files or application logic were added.
- Browser visual verification remains pending because this environment cannot
  launch local Chromium or reach the local app from the connected browser.
  Check both themes, compact viewports, long labels, keyboard focus, pricing,
  optimization/validation and the six tutorial anchors in a normal browser.


## Glass surface restoration

- Shared map panels and compact controls use 80% opaque theme surfaces, with a
  24px backdrop blur and transparent header tints. Light/dark theme colors, shared
  overlay shadows, typography, dimensions and selection colors stay intact.
- Restored backdrop filters on the trip sidebar/menu, place cards/search results,
  dialogs, optimization companions and route review sidebar. The transparent
  multi-panel dialog wrapper stays unfiltered so its gaps remain transparent.
- Browsers without backdrop-filter support keep solid surfaces. Reduced
  transparency restores solid panel/control backgrounds and zero blur.
- Workspace build/type compilation, lint, changed-file formatting and LF/whitespace
  checks pass. Browser rendering remains unverified in this environment.

## Layer action menu and deletion (2026-11-11)

- Replaced the header shuffle shortcut with an ellipsis menu containing the
  existing endpoint-preserving shuffle and a destructive delete action. Shuffle
  remains disabled with fewer than four places; deletion also works for empty
  and hidden layers. Menu dismissal covers outside clicks, focus leaving the
  menu, Escape and scrolling, with arrow/Home/End navigation and focus return.
- Added an alert dialog with the layer title, initial focus on Cancel, duplicate
  submission protection and controller error feedback. The shared dialog traps
  focus and supports Escape/backdrop cancellation. Layer removal uses the same
  snapshot validation, history and autosave as other edits; the existing schema
  accepts zero layers and existing selection hooks exclude removed objects.
- Reused existing localized menu, shuffle, delete and confirmation messages;
  no translation source or generated localization snapshot was changed.
- Typecheck, production build, lint/localization lint and architecture checks
  pass. Existing unrelated size warnings remain. Whitespace and LF checks pass.
- Actual UI verification is blocked: Vite starts at `127.0.0.1:5173`, but the
  connected browser reports `ERR_CONNECTION_REFUSED`. Before release, manually
  check menu placement near the bottom of the sidebar, both themes, long titles,
  keyboard navigation, cancel/confirm, undo/redo, saved reload and final-layer
  deletion against a disposable trip. No test files, mocks or dependencies added.

## Stronger glass appearance

- Lowered the shared panel/control opacity from 80% to 50%, preserving the 24px
  backdrop blur. Header tints drop from 35% to 15%.
- Removed solid backgrounds from the sidebar action strip, active/hidden Day
  headings and selected/hovered place rows. Selection rings/text and transient
  drag feedback remain in place.
- Solid fallbacks for unsupported browsers and reduced-transparency preferences
  remain. This pass changes background alpha, not text opacity or blur strength.
- Build/type compilation, lint and changed-file formatting/LF checks pass; no
  browser rendering result is claimed in this environment.

## Optimization day chooser placement and scrolling (2026-11-11)

- Moved the chooser to a portal host inside the optimization dialog, outside the
  clipped settings body. It measures the main settings card and opens to its left
  with a 16px gap where space permits. Compact viewports clamp the chooser inside
  the viewport; resize and outer scroll keep its position current.
- Replaced a shrink-wrapped maximum height with an explicit list height capped
  at 400px and the available viewport height. Radix uses automatic scrollbar
  visibility whenever the list overflows. Arrow/Home/End focus scrolls to the
  relevant option; opening reveals the current day. Outside dismissal, Escape,
  focus return and blur checks include the portaled list within the modal scope.
- Typecheck, full production build, lint/localization lint and architecture checks
  pass. Existing unrelated lint warnings remain. Formatting, whitespace and LF
  checks pass. No mock responses, test files, localization changes or new
  dependencies were introduced.
- Rendered verification remains pending due to the local browser connection
  limitation. Manually review a trip with many days, selected last day, wheel and
  scrollbar dragging, keyboard navigation, resized/compact viewports and both
  themes in the deployed app.

## Horizontal globe rotation and inertia (2026-11-11)

- Based on the updated `impl` head `ff34de3`. Fixed the presentation tilt for
  mouse, pen and touch input. Pointer Y is no longer tracked or applied; vertical
  touch scrolling retains `touch-action: pan-y`.
- Added smoothed, capped horizontal release velocity and exponential damping.
  Time-based velocity integration handles different render rates. A new drag
  stops coasting immediately. Releasing after a pause, pointer cancellation,
  capture loss, window blur and reduced motion do not trigger inertia.
- Automatic forward rotation now accelerates smoothly toward the existing speed.
  Four-second idle recovery, shortest-path return and the existing rewind loop
  remain. Hidden/offscreen/reduced-motion playback clears residual velocities.
- Workspace typecheck, production build, lint/localization lint and architecture
  checks pass. Function-size warnings remain. Formatting, whitespace and LF
  checks pass. No dependencies, localization changes or automated tests added.
- Browser interaction verification remains pending due to the existing local
  browser connection restriction. Review horizontal/diagonal drags, both flick
  directions, holding before release, interruption/cancellation, idle recovery,
  reduced motion and mobile vertical scrolling in the deployed build.
