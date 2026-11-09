# P0-A / P0-B — AI TripCommand and per-Trip single chat (2026-11-06)

Scope of this PR: only the two P0 items below. Task 01~13 follow-ups are out of scope (see Backlog).

## P0-A — Gemini response → TripCommand Plan → Preview → Apply

- Backend: Gemini provider can use native tools (`GEMINI_NATIVE_TOOLS=1`, `/v1beta/`), with a
  base-URL allow-list guard; non-OK upstream statuses are logged as `gemini_upstream_error`.
  Flag is off by default. `backend/.env.example` lists names only, no values.
- Frontend: strict single-JSON Plan parser, context builder split into message parts
  (stays under the 4000-char per-message limit), adapter/executor into `TripEditController`.
- `TripEditController`: after an UNKNOWN commit, save/undo/redo/batch/dispatch are refused until
  `reconcileUnknownCommit` succeeds. `HttpTripRepository` keeps the revision cache consistent.

## P0-B — one chat per Trip

- `TripAiRegion` + `singleSession` prop on the chat panel: no chat list/hamburger in `/map`;
  persistence key `trasolve.trip-chat.v1:<userId>:<tripId>`; Trip A/B conversations are isolated and
  survive reload. `/testbed/ai-chat` keeps its multi-chat UI.
- This supersedes the unmerged `origin/w9-single-chat-mode` (`singleChat` prop, no per-Trip
  persistence/TripCommand wiring). The two must not both be merged; close that branch after this lands.

## Verification (integration worktree on top of `origin/w9` a183e41)

| Check | Result |
| --- | --- |
| typecheck / build | PASS |
| backend tests | 9/9 PASS |
| oxlint, eslint + prettier on touched files | PASS |
| architecture:check | FAIL, 4 violations — identical on pristine `origin/w9` (pre-existing) |
| localization:lint | FAIL, 98 missing keys — identical on pristine `origin/w9` (pre-existing) |
| Human Acceptance (2026-11-06) | P0-A PASS, P0-B PASS (user-reported; Seoul 3 days `[2,6,7]`, 15 places; Seoul/Tokyo chat isolation + reload) |
| Browser, weak-ETag proxy on this base | PASS (rename, UNKNOWN reconcile, Trip A/B isolation, flag OFF/ON) |

Live Gemini was exercised before this PR; no additional live calls were made for the integration.

## Known limitations (not blocking P0)

- A moved place keeps its previous visit time; connector is a straight line (no Routes key).
- UNKNOWN refusal shows no on-screen message; Plans over 4000 chars are unusable.

## Backlog (not part of P0)

Visit-time reorder on move, real Routes, Task 01 3-chat live concurrency, tcache Task 02/03
live provider, Task 04 Local-vs-Gemini/KMZ, Task 05 compound/live commands, fixing the
pre-existing architecture/localization lint failures.
