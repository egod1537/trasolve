# Travel map

Route entries use class page roots for dependency ownership and lifecycle; reusable
UI remains function components. See [Page root ownership](../docs/page-roots.md).
The map is composed from LayerPanel, MapViewport and MapAiRegion; see
[Map visual regions](../docs/map-regions.md) for ownership and layout boundaries.

The landing page links to `/map`, a backend-backed trip list and Google Maps itinerary
editor. Create an empty trip or explicitly create the Tokyo example from
`src/data/demoTrip.ts`. The class route root `MapPage` assembles one external TripMapStore
and frontend TripMapController per workspace and passes a stable value to TripMapProvider.
Sidebar and TripMapLayer consume the
same immutable snapshot through useSyncExternalStore. Commands optimistically
update it, save through `src/api/trips.ts`, then apply the canonical response or
roll back on failure. Selection/camera focus live separately in `useMapUi`.
See [Frontend state/binding](../docs/frontend-trip-map.md) and
[TripMap persistence](../docs/trip-maps.md).
Provider-neutral camera operations are defined by
`src/adapters/map/MapAdapter.ts`; `src/adapters/map/GoogleMapAdapter.ts` translates
them to Google Maps calls. `src/maps/googleMaps.ts` only loads and configures the
SDK.
`MapRuntime.objects` implements `src/adapters/map/MapObjectController.ts`.
`GoogleMapObjectController` owns native `AdvancedMarkerElement` and `Polyline`
instances, bound to the runtime's map. The SDK positions markers during pan/zoom;
React does not project their coordinates or render their content. Marker DOM and
styles live in the adapter, preserving order numbers, day colors and selection.
`TripMapLayer` reconciles marker handles by place ID and polyline handles by day ID.
Labels, coordinates and styles update via setters without rebuilding objects.
The old MapMarker/RoutePolyline wrappers, useMapMarker, MapModel and useMapModel
are removed. The generic useMapPolyline hook remains for GoogleMap.polylines props.

`GoogleOverlayHost` and its `OverlayView` remain available for specialized
map-anchored React UI. Ordinary markers and route lines do not use the overlay
host. The obsolete itinerary projection hook and SVG route rendering are removed.

### Object lifecycle

The controller contract exposes `addMarker`, `addPolyline`, `remove`, `clearLayer`,
`clear`, and `dispose`. Polygon/circle options, styles and handles are defined as
optional provider capabilities; this implementation supports markers and polylines.
Handles share `id`, `setVisible`, `setZIndex` and idempotent `remove`. Marker handles
also update position, label, title, color and selection, and provide `onClick`
with an unsubscribe function. Polyline handles update path and partially update
style. Hooks reset omitted props to defaults without recreating the native object.

IDs are unique within a runtime; duplicates throw before creating SDK objects.
Omitting an ID generates one. A layer is fixed for the handle's lifetime.
`clearLayer('route')` removes that layer only; `clear()` removes all objects and
allows subsequent additions. Removal detaches SDK objects, removes registered
listeners and clears registry/layer membership. Removed handles are inert; create
a new handle (or remount its React owner) to display the object again.
Runtime disposal cleans objects before the overlay/camera, releases map references,
and rejects further additions. React cleanup may safely remove a handle again.

```ts
const marker = runtime.objects.addMarker({
  layer: 'itinerary',
  position: { lat: 35.6586, lng: 139.7454 },
  label: '1',
  color: '#2563eb',
});
const unsubscribe = marker.onClick(() => marker.setSelected(true));
marker.setLabel('2');
unsubscribe();
marker.remove();

const preview = runtime.objects.addPolyline({
  layer: 'ai-preview',
  path: [{ lat: 35.6586, lng: 139.7454 }, { lat: 35.6812, lng: 139.7671 }],
  style: { color: '#2563eb', width: 5, opacity: 0.85 },
});
preview.setStyle({ opacity: 0.5 });
runtime.objects.clearLayer('ai-preview');
```

## Local setup

Copy `frontend/.env.example` to `frontend/.env.local`, then set
`VITE_GOOGLE_MAPS_API_KEY` to a browser key with Maps JavaScript API enabled and
billing configured. Restrict it to Maps JavaScript API and the HTTP referrers used
by the app (including the local development origin). Set
`VITE_GOOGLE_MAPS_MAP_ID` to a JavaScript map ID; `DEMO_MAP_ID` is the development
fallback. Restart `npm run dev` after changing the file.

These are Vite build-time inputs, so a production build needs the variables
available when Vite runs. Changing container runtime variables alone does not
change the built client. The branch deployment reads `JJS_GOOGLE_MAPS_API_KEY` and
`JJS_GOOGLE_MAPS_MAP_ID` from the host deployment environment and passes them to
the frontend image build.

Without a key or if Google Maps fails to load, the page keeps the itinerary usable
and shows a map connection message; it does not substitute a fake map.
MapToolbar search is a local UI placeholder without API calls. The route lines connect each day's places
by `order`, and are not road routes or travel-time estimates. `TripRoute.path`
accepts coordinate arrays so a future Routes API adapter can supply the geometry
without changing itinerary selection or marker components.

## Reusable Google Maps components

`src/components/google-map/GoogleMap.tsx` owns SDK initialization and cleanup
through `src/maps/createGoogleMapRuntime.ts`. It works without itinerary data and
has a default height of 400px. Override `style` or `className` for page layout.
The existing `/map` view uses this component and retains its itinerary objects,
camera padding, and loading/error UI. Camera calculations remain in
`src/domain/map/cameraPolicy.ts`.

`src/adapters/map/MapRuntime.ts` defines the provider-neutral runtime contract;
`src/domain/map/mapTypes.ts` owns coordinates, bounds, places, events, options,
and polylines. Component types re-export the existing public names for compatibility.
The runtime imports these contracts directly and does not depend on React components.
The `GoogleMap` component is the composition point for the runtime factory and loader
configuration. Direct SDK objects and types stay in `src/maps/` and `src/adapters/map/`.
Overlay and camera contracts remain available. All marker/polyline creation is
owned by the object controller; the former runtime `setPolylines` method is removed.
The public `GoogleMap.polylines` prop remains compatible and uses controller-backed
children, updating native paths/styles in place by array position.

HTTP clients live in `src/api/health.ts`, `routes.ts`, and `places.ts`. They call
Trasolve endpoints, accept cancellation signals, and validate shared schemas.
`maps/` contains only rendering infrastructure and SDK loading. The legacy
`googleDirections.ts` client has moved to `api/routes.ts`; import route types and
`TravelMode` directly from `@trasolve/shared`. Lint rejects direct `google`/`fetch`
access and concrete Google adapter imports in components, pages, hooks, and domain code.
Google Routes raw responses are kept only for Test Bed diagnostics; application
map data uses normalized paths and plain coordinates.

```tsx
import { useRef, useState } from 'react';
import { GoogleMap } from './components/google-map/GoogleMap';
import { GooglePlaceSearch } from './components/google-map/GooglePlaceSearch';
import type { GoogleMapHandle, MapPlace } from './components/google-map/types';

function Example() {
  const mapRef = useRef<GoogleMapHandle>(null);
  const [place, setPlace] = useState<MapPlace | null>(null);
  return (
    <>
      <GooglePlaceSearch onSelect={setPlace} />
      <GoogleMap
        ref={mapRef}
        center={place?.location}
        zoom={12}
        options={{ zoomControl: true }}
        onReady={(map) => map.setZoom(14)}
        onMapClick={({ lat, lng, placeId }) => console.log(lat, lng, placeId)}
      />
    </>
  );
}
```

Public types use plain coordinates, bounds, places, and polylines, with no Google
SDK types. `center` and `zoom` apply when their values change; user camera gestures
are not continually overwritten. `options` applies partial option updates without
recreating the map; use `null` to clear min/max zoom limits. Changing `mapId`
recreates the runtime because Google does not support changing it on an existing
map. Callback changes do not recreate the map or accumulate event listeners.
`onReady(handle)` runs once per runtime; use it for commands that need a loaded
map. Ref commands before readiness or after disposal have no effect.

`onMapClick`, `onCenterChanged`, and `onZoomChanged` receive plain data. The map
click event is a `MapClickEvent`: `{ lat, lng, placeId?: string }`. Google POI
icon clicks include `placeId` when supplied by the SDK; ordinary map clicks omit
it. POI icons are clickable by default; `options.clickableIcons: false` disables
them. Clicking an arbitrary building area does not look up a place ID.
The ref supports `panTo`, `setZoom`, and `fitBounds`. `polylines` accepts coordinate
paths and optional color, weight, and opacity; it performs no directions requests.
For custom React overlays, children can call `useGoogleMap()` to access the
existing `MapAdapter`, `MapObjectController` (`objects`), `MapOverlayHost`, and canvas ref. Children mount when the
runtime is ready; the component owns their runtime's lifecycle.

## Testbeds

Open `/testbed` for the development debug page directory. It links to Google Maps
at `/testbed/google-maps` and AI Chat at `/testbed/ai-chat`.

### AI Chat testbed

`/testbed/ai-chat` embeds the same `MapAiPanel` used by `/map`, without loading a
map or the Google SDK. It uses `src/api/chat.ts` and the actual backend provider.
Check conversation history, Enter/Shift+Enter/IME input, the animated waiting dots,
duplicate-submit prevention, and error messages. The reset button starts a fresh
conversation and cancels any pending request by unmounting the previous panel.
The close button returns to `/testbed`. No API or provider logic is duplicated.

### Google Maps testbed

This is a development UI for manual verification with real Google APIs, not an
automated test suite. The repository does not maintain unit/integration test
files, test scripts, or test-only mocks and dependencies. Validate changes with
type checking, builds, lint, and browser interaction. The testbed has no entry
link in the landing page or service menus.

`GoogleMapsTestPage` composes the five panels in `src/components/google-maps-test/`
and connects map/selection callbacks. `src/hooks/useDirectionsState.ts` owns route
inputs, requests, API state, and route selection. Panels render data and forward
events; shared Maps/Places/Routes modules and `google-maps-test.css` remain the
same. Coordinate rendering, initial map settings, and endpoint types are shared
within the testbed components.

Open `/testbed/google-maps` to search for places, inspect click coordinates and camera
events, choose an origin/destination, and request directions. Controls and the map
appear side by side on wide screens and stack on narrow screens. Both the last
map click and a searched place have buttons to populate either endpoint using
a place ID when available, otherwise coordinates; editing the input switches
back to an address request. Input hints
show which form will be sent. Camera center and zoom are visible from map readiness
and update through the shared component's callbacks.

The page shows the Routes API state (`IDLE`, `LOADING`, `SUCCESS`, `ERROR`), route
count, description, distance, duration, and warnings (including an explicit empty
state). Route buttons change the displayed polyline and fit its bounds; a separate
button can fit the selected route again after panning. The collapsible Debug area
shows the last submitted request, route coordinates, event logs, and Raw Response
JSON in scrollable panels. Raw Response is the Google Routes REST response for
the requested fields. Empty route results and API failures are displayed separately.

The browser key needs only **Maps JavaScript API**, with HTTP referrer restrictions
for the app. Copy `backend/.env.example` to `backend/.env.local`, set
`GOOGLE_ROUTES_API_KEY` for **Routes API** and `GOOGLE_PLACES_API_KEY` for
**Places API (New)**, and restart `npm run dev`. The backend loads this file
relative to its own directory; existing process environment values take priority.
Do not prefix either server key with `VITE_`. For deployment, set both variables
in the host's `~/.config/jjs/deploy.env`; Compose passes them only to the backend.
Use server-appropriate restrictions (such as the server's outbound IP), not
HTTP referrers. All features still call real Google APIs.

`GooglePlaceSearch` uses a standard input and backend autocomplete, and returns a
`MapPlace` through `onSelect`. Search starts at two trimmed characters after a
300ms debounce. Input changes cancel previous requests and invalidate stale
autocomplete/detail responses. Arrow keys navigate, Enter selects, and Escape
closes the list. Korean/Japanese IME composition waits until committed. Clicking
a suggestion fetches its details before calling `onSelect`. Each autocomplete
session shares a token with its details request and then discards the token.
`src/api/places.ts` calls only Trasolve endpoints and validates normalized
responses with `@trasolve/shared`; it does not load a Google SDK.
`src/api/routes.ts` calls
`POST /api/routes`; request/response schemas and types live in `@trasolve/shared`.
Google Maps backend code lives in `backend/src/google/maps/routes.ts`: the single
`Routes` class handles HTTP, validates requests, calls Google REST, and normalizes
responses. `ApiError` in `errors.ts` defines API errors.
`backend/src/instances.ts` loads the environment and creates one `Routes` instance
per Node.js process. Backend consumers import only `API` from that module and use
`API.Route.queryRoutes(request)` with a typed `DirectionsRequest`, or
`API.Route.handle(request, response)` for HTTP input validation and responses.
`DirectionsRequestBuilder` from `@trasolve/shared` can build requests for either
the frontend `getDirections` function or backend `queryRoutes` method. Its fluent
setters configure endpoints, travel mode, intermediates, and alternative routes;
`build()` validates the shared schema and returns an independent request object,
throwing `ZodError` for invalid or incomplete settings.
`API.Route` directly references the shared `Routes` instance. Lint rules reject direct implementation imports
outside the Maps module and instance wiring, and reject value imports of `Routes`
inside the Maps implementation. `Routes` receives its API key and optional timeout (default 15000ms) through its
constructor; request construction and response normalization are private methods.
Requests support tagged address, coordinate, and place-ID endpoints, travel mode,
up to 25 intermediate waypoints for all travel modes, and alternative routes.
For transit with waypoints, the backend queries each adjacent pair in parallel
under one shared timeout and combines the first route from every segment.
Distances and durations are summed (or null if any segment omits that value).
Any segment without a route produces an empty overall result; API errors fail
the whole request. Segment requests/responses appear in `rawResponse.segments`.
These independent queries do not account for timetable connections, waiting
between segments, or stopover time; result warnings explain those limitations.
No combined transit alternatives are generated, even when requested.
Google does not return alternatives for other modes when intermediates are supplied.
The testbed exposes travel mode and alternative-route controls.
Places and routing do not load a browser SDK. Map rendering still uses the Google
Maps JavaScript SDK (`maps`, `core`, and `marker`) and its browser key. The existing `/map`
itinerary search remains a disabled placeholder and is not yet connected to routing.

```ts
import { TravelMode } from '@trasolve/shared';
import { getDirections } from './src/api/routes';

await getDirections({
  origin: { type: 'place', placeId: selectedPlace.id },
  destination: { type: 'coordinates', lat: 35.6586, lng: 139.7454 },
  travelMode: TravelMode.DRIVING,
});
```

The endpoint requires JSON, limits request bodies to 16KB, and validates coordinate
ranges and endpoint variants. Google calls time out after 15 seconds. Errors use
`{ error: { code, message } }`, with distinct configuration, validation, quota,
upstream, and timeout failures. The development client times out after 20 seconds.
The endpoint currently has no user authentication or per-user rate limiting.

References: [Place Autocomplete](https://developers.google.com/maps/documentation/javascript/place-autocomplete-new),
[Routes REST](https://developers.google.com/maps/documentation/routes/compute_route_directions).

Manual checks with a configured key: open `/map`, select a place in the sidebar,
click a marker, collapse its Day then select that marker again, select a Day,
and use “전체 일정 보기”. Verify markers remain clear of the panel, and that dragging,
wheel/pinch zoom and double-click zoom work. On narrow screens the itinerary
becomes a lower panel while map gestures and attribution remain accessible.
Also pan far enough to bring previously hidden places into view, zoom repeatedly,
and leave and reopen `/map`; check that route lines remain visible and markers
stay attached to their places without duplicate overlays.

References: [API loading](https://developers.google.com/maps/documentation/javascript/load-maps-js-api),
[custom overlays](https://developers.google.com/maps/documentation/javascript/reference/overlay-view),
[camera bounds and padding](https://developers.google.com/maps/documentation/javascript/reference/map#Map.fitBounds).

# Frontend build metadata

The landing header reads build metadata only through `src/buildInfo.ts`. Local and
preview builds show `branch · shortSha` to the left of the Trasolve brand. The
commit link opens the full SHA on GitHub. Production builds show no metadata.

- `npm run dev`: uses the `local` channel and reads the current branch and HEAD at
  Vite startup.
- `npm run build`: derives `production` only for `main`; every other known branch
  is `preview`. If no branch can be read, it safely falls back to `local`.
- `npm run preview -w @trasolve/frontend`: serves the already built assets and does
  not change their embedded metadata.

Build inputs use this priority order:

| Metadata   | Priority                                                                  |
| ---------- | ------------------------------------------------------------------------- |
| Channel    | `VITE_BUILD_CHANNEL`, then local dev or exact branch-based detection      |
| Branch     | `VITE_GIT_BRANCH`, GitHub/CI variables, existing JJS variables, local Git |
| SHA        | `VITE_GIT_SHA`, GitHub/CI variables, `JJS_COMMIT_SHA`, local Git          |
| Repository | `VITE_GIT_REPOSITORY_URL`, GitHub/JJS repository, Trasolve default        |

Supported channels are `local`, `preview`, and `production`. Git command failures
produce empty values and never stop Vite. Missing branch or SHA values are omitted
from the UI; if both are missing, the whole metadata area is hidden.

The existing branch deployment script passes its resolved branch, exact commit,
channel, and repository URL through Compose build args to the frontend image. No
runtime hostname detection is used.
