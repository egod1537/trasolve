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
