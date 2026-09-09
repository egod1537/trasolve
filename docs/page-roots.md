# Page root ownership

Each route in frontend/src/app/routes.tsx renders a React class page root. Lazy
loading and URLs are unchanged; no route hook bridge is currently needed.

| Route | Class root | Ownership and cleanup |
| --- | --- | --- |
| / | LandingPage | Starts health request on mount; owns and aborts its request. |
| /map | MapPage | Renders TripWorkspace; no preselection store/controller. |
| /testbed | TestbedPage | Static navigation, no imperative resources. |
| /testbed/google-maps | GoogleMapsTestPage | Function content owns map/directions cleanup. |
| /testbed/ai-chat | AiChatTestPage | Function content owns reset UI; MapAiPanel cancels chat requests. |

TripWorkspace owns HttpTripRepository, catalog, selected Trip and abortable
list/open/create/delete requests. The picker is outside Context. Only selection
mounts TripSession, which creates TripStore and TripEditController and passes their
stable value to TripProvider. MapWorkspace subscribes to the live session store.
TripProvider creates no resources.

Switching Trip or explicitly reloading replaces the keyed session. Session unmount
calls cancelPending; Workspace independently aborts catalog/action work. Trip data
is not copied into MapPage class state. Optimistic commands, rollback and route
invalidation remain in plain TypeScript TripEditController. Map objects stay under
GoogleMap/MapRuntime and TripLayer.

Session initializers compose inert dependencies without I/O or subscriptions.
StrictMode can discard initialization and repeat effect cleanup/setup safely:
cancellation is idempotent, not permanent disposal. LandingPage creates a fresh
AbortController on every mount. Reusable UI remains function components with
existing request/listener/object cleanup.

Manual verification covers every route, picker/session lifecycle, reorder/save errors,
marker identity, camera, AI and page reentry under StrictMode. HTTP checks and
lint/typecheck/build do not substitute for actual browser interaction.
