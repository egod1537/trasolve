# Page root ownership

Every entry in `frontend/src/app/routes.tsx` renders a React class page root. Lazy
loading and URLs are unchanged. Routing currently supplies no params or navigation
hooks, so no function route bridge is needed.

| Route                  | Class root         | Owned dependencies and cleanup                                                                                                                 |
| ---------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                    | LandingPage        | Starts the existing health API client in componentDidMount. Owns its AbortController; unmount aborts it and late results cannot update state.  |
| `/map`                 | MapPage            | Composes TripMapStore + TripMapController once in the constructor. Owns the stable Context value; unmount cancels pending controller requests. |
| `/testbed`             | TestbedPage        | Static navigation; no imperative resources.                                                                                                    |
| `/testbed/google-maps` | GoogleMapsTestPage | Function content retains map and directions bindings with their existing cleanup. No additional page runtime.                                  |
| `/testbed/ai-chat`     | AiChatTestPage     | Function content retains conversation reset UI. MapAiPanel owns and cancels its chat requests.                                                 |

MapPage is now the `/map` route entry, replacing TripMapsPage. The former list and
editor function components are `TripMapsWorkspace` and `MapWorkspace` under
`pages/map/components`. TripMapsWorkspace owns its abortable catalog query effect;
MapWorkspace owns selection, camera and panel state. They consume the same
page-owned TripMapStore. TripMapProvider only passes the supplied value to Context;
it never creates dependencies or disposes dependencies owned by its caller.

TripMap is not copied into React class state. The only class state introduced is
LandingPage's health indicator. Commands, optimistic updates, rollback and route
invalidation remain in the plain TypeScript TripMapController. Native map objects
remain under GoogleMap/MapRuntime and TripMapLayer, with no direct page access.

Constructors compose inert dependencies and do not start requests or subscriptions.
StrictMode may construct and discard an instance; this therefore leaks no resource.
MapPage cleanup uses idempotent cancelPending instead of permanently disposing the
controller, allowing StrictMode's mount/unmount/mount cycle to reuse it safely.
LandingPage creates a fresh AbortController on every mount. Child effects retain
their existing abort/listener/object cleanup and all reusable UI remains functional.

Manual review should cover every URL, health status, map create/open/reorder,
marker selection and identity, lines, pan/zoom, AI chat, Places search and leaving
and reopening pages under StrictMode. Browser verification of this migration was
blocked by the execution tool's policy; successful lint/typecheck/build and HTTP
route checks are not a substitute for those UI checks.
