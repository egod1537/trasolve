# Route and session ownership

Route definitions live in `frontend/src/app/router/routes.tsx`. Page modules compose
features; reusable UI remains function components. A route boundary does not imply
that all its descendants use the same component style.

| Surface         | Owner                                                         | Cleanup                                                                       |
| --------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Landing         | `pages/landing/LandingPage.tsx`                               | Abort health request                                                          |
| Map catalog     | `features/map-workspace/MapWorkspacePage.tsx`                 | Abort list/open/create/delete requests                                        |
| Selected trip   | `features/map-workspace/components/TripSession.tsx`           | Destroy controller on final unmount; deferred cleanup accommodates StrictMode |
| Public share    | `pages/share/PublicSharePage.tsx`                             | Abort loading; supply read-only trip session                                  |
| Chat            | `features/ai-chat` hooks and UI                               | Abort thread requests, remove focus/menu listeners                            |
| Job testbeds    | `features/troute-testbed` and `features/tcache-route-testbed` | Abort gateway/result/stream work; clear polling and reconnect timers          |
| Admin/analytics | Route screens and resource hooks                              | Cancel resource requests through existing owners                              |

Before trip selection there is no TripStore or edit controller. TripSession creates
inert dependencies in its initializer and TripProvider passes their stable value.
A keyed session replacement cannot receive the previous session's async results.
Readonly sessions contain a store but no edit controller. Selection/camera UI state
is distinct from persisted trip data.

Store snapshots are immutable and structurally shared. useTripData observes trip
changes; useTripState additionally observes save progress/errors. Controller methods
route local actions through commands; persistence adapters retain their canonical
readback, conflict and unknown-commit semantics.

See [Frontend architecture](frontend-source-layout.md) and
[Manual verification](frontend-verification.md).
