# Frontend refactor migration and verification

## Scope

- Branch: `impl`
- Baseline: `41d8f9d9cf86a6981ff9799c276892aeb57cc7ad`
- Target dependency direction:
  - `app -> pages/features/entities/shared`
  - `pages -> features/entities/shared`
  - `features -> entities/shared`
  - `entities -> shared`
  - `shared -> shared`

The `map` layer is the provider-neutral map runtime boundary. It may depend on
`shared`, while page, feature, and app layers may consume it.

## Phase ledger

Each phase must be reviewed and reverted independently. Do not combine file
moves, state-management changes, and visual changes in one commit or pull
request.

| Phase | Scope                             | Required evidence                                |
| ----- | --------------------------------- | ------------------------------------------------ |
| 0     | Baseline E2E and Profiler         | Smoke record and profiler capture                |
| 1     | Alias and public APIs             | Architecture check and typecheck                 |
| 2     | Extract entities                  | Architecture check and build                     |
| 3     | Extract features                  | Architecture check and build                     |
| 4     | Split MapWorkspace                | Map smoke and map-instance identity check        |
| 5     | Separate state and polling        | Job recovery, stale-response, and cleanup checks |
| 6     | Shared UI and CSS                 | Light/dark/system and reduced-motion checks      |
| 7     | Performance cleanup               | Profiler comparison and bundle comparison        |
| 8     | Remove legacy paths and dead code | Legacy import scan and full smoke                |

## Current verification record

As of 2026-09-17, the alias, public API, entity, feature, MapWorkspace,
state/polling, shared UI, performance, and legacy cleanup code is present in the
working tree. The architecture check reports zero cycles and zero boundary
violations. Frontend typecheck also rejects unused locals and parameters.

The following release gates remain open:

- The complete manual smoke matrix below has not been executed against a fully
  configured backend, Google Maps key, troute service, and AI service.
- The existing backend test suite targets removed inbound callback APIs and old
  schema names, so `npm test` does not currently typecheck. Repository policy
  prohibits maintaining or replacing it with new automated test code in this
  refactor.
- The current working tree contains multiple phases together. Before opening a
  pull request, reconstruct the history into the phase boundaries above so
  each phase can be reverted independently.
- Repository-wide formatting is blocked by the pre-existing formatting of
  `backend/src/googleOAuthHttp.ts`; files changed by this phase are formatted.

Do not mark functional equivalence complete until these open release gates are
resolved or explicitly waived.

For every phase, run:

```powershell
npm run architecture:check
npm run lint
npm run typecheck
npm run build
```

The repository policy does not permit adding or retaining frontend automated
unit, integration, or Playwright test files, fixtures, mocks, or test-only
dependencies. Therefore the UI flows below are manual release checks. Existing
backend tests may be run without extending their scope:

```powershell
npm test
```

Record the commit, browser, viewport, API environment, result, console errors,
and captured screenshots or traces for each manual run.

## Manual smoke flows

### A. Trip

- Open the trip list.
- Create a trip and confirm it appears exactly once.
- Open the trip and confirm its persisted days and places.
- Delete it and confirm it disappears after refresh.

### B. Map

- Search for a real place through the backend and add it.
- Select the place and confirm only its marker changes.
- Reorder places repeatedly and confirm markers are not recreated.
- Edit visit time and confirm the saved value after reload.
- Open and close the AI panel 20 times. Confirm the map instance remains the
  same and the map does not jump during the width transition.

### C. Optimization

- Submit a Job and confirm the pending row is selected immediately.
- Observe running progress and terminal result through SSE.
- Cancel another active Job and confirm cancellation only after the server
  response, SSE event, or recovery snapshot.
- Leave the list open for 30 seconds. Confirm unchanged polling responses do
  not rerender unchanged rows and do not overwrite newer SSE state.

### D. AI

- Open the panel, send a message, receive a response, and close the panel.
- Confirm the request is cancelled or retained according to the visible UI
  state and that no document listener remains after unmount.

### E. Theme

- Check light, dark, and system modes on the map and testbed pages.
- Enable reduced motion and confirm spinners, dialogs, and panel transitions
  respect it.

For every flow, the pass condition includes no uncaught console error, no React
key warning, and no duplicate network mutation.

## Contract verification

Validate the following network boundaries against the shared Zod schemas and
record the request/response payload with secrets removed:

| Contract                | Expected behavior                                                              |
| ----------------------- | ------------------------------------------------------------------------------ |
| Optimize request/result | Submit returns `202` and a Job id; completion result validates before UI use   |
| Flat remote Job         | GET/list payload maps to the local mirror without nested transport assumptions |
| Cancel                  | UI does not invent terminal cancellation before remote confirmation            |
| Job list                | A stale list response cannot replace a newer SSE snapshot                      |

The browser must only call the Trasolve backend. A browser request to a troute
origin is a release blocker.

## Profiler baseline

Development builds publish React measures named `trasolve:react:*` for the map
layer panel, viewport, AI panel, Job list, and Job detail. Capture them after
the smoke operations with:

```js
performance
  .getEntriesByType('measure')
  .filter((entry) => entry.name.startsWith('trasolve:react:'));
```

Compare `actualDuration` and `baseDuration` for AI toggles, place selection,
reorder, unchanged Job polling, and terminal result display. The common UI
target is a 16–32 ms commit budget. Google Maps renderer/GPU baselines and the
measurement environment are documented in
`docs/google-map-performance-investigation.md`.

## Bundle comparison

Both revisions were built with Node 24 and Vite 8.2.2. Values below sum every
emitted JavaScript or CSS asset and intentionally exclude images and source
maps.

| Assets     | `41d8f9d` raw |  Current raw | `41d8f9d` gzip | Current gzip | Gzip delta |
| ---------- | ------------: | -----------: | -------------: | -----------: | ---------: |
| JavaScript |  1,549.49 KiB | 1,563.63 KiB |     495.46 KiB |   502.58 KiB |  +7.12 KiB |
| CSS        |    621.53 KiB |   623.96 KiB |      75.60 KiB |    78.45 KiB |  +2.84 KiB |

JavaScript chunks increased from 21 to 26 and CSS chunks from 11 to 14 because
page, feature, Job builder, and route-optimization boundaries are loaded
separately. Review the route-specific chunks as well as the total before
accepting future growth.

## Architecture and legacy guard

`npm run architecture:check` fails on:

- reverse layer imports;
- cross-entity imports;
- feature/entity imports that bypass the slice root `index.ts`;
- missing or nested feature/entity public indexes;
- imports or source files under removed legacy roots;
- three-level-or-deeper relative imports;
- raw `fetch` outside shared or feature API boundaries;
- dependency cycles.
- unused TypeScript locals and parameters during frontend typecheck.

Removed roots include `frontend/src/api`, the former `pages/map` domain,
repository, API, component, hook, and store folders, the old troute testbed
folder, and the former shared component/style folders. Compatibility re-exports
must not be restored after Phase 8.

## Revert discipline

- Keep one phase per commit series and avoid cross-phase fixups.
- Capture the four required command results and manual smoke record before
  moving to the next phase.
- Revert a failed phase as a unit; do not preserve compatibility re-exports to
  make a partially reverted tree compile.
- Prefer behavioral verification over snapshots.
