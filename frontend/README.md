# Travel map

The landing page links to `/map`, a full-screen Google Maps itinerary view.
The sample trip is in `src/data/demoTrip.ts`; it does not require the backend.
Map selection and focus state live in `src/domain/map/MapModel.ts` and are exposed
to React as a cached external-store snapshot through `src/hooks/useMapModel.ts`.
Provider-neutral camera operations are defined by
`src/adapters/map/MapAdapter.ts`; `src/adapters/map/GoogleMapAdapter.ts` translates
them to Google Maps calls. `src/maps/googleMaps.ts` only loads and configures the
SDK.
Markers and route lines render through a React portal into
`src/adapters/map/GoogleOverlayHost.ts`, which owns a Google Maps `OverlayView`.
`MapOverlayHost` supplies pane-local coordinates and draw notifications, while
`useMapProjection` culls markers and caches coordinates until the projection
changes. The SDK moves the pane during panning; zoom, heading, tilt, and pane
rebasing invalidate the coordinate cache. Unmounting removes the overlay and its
subscriptions.

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
Search is a disabled UI placeholder. The route lines connect each day's places
by `order`, and are not road routes or travel-time estimates. `TripRoute.path`
accepts coordinate arrays so a future Routes API adapter can supply the geometry
without changing itinerary selection or marker components.

## Reusable Google Maps components

`src/components/google-map/GoogleMap.tsx` owns SDK initialization and cleanup
through `src/maps/createGoogleMapRuntime.ts`. It works without itinerary data and
has a default height of 400px. Override `style` or `className` for page layout.
The existing `/map` view uses this component and retains its itinerary overlays,
camera padding, and loading/error UI. Camera calculations remain in
`src/domain/map/cameraPolicy.ts`.

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
existing `MapAdapter`, `MapOverlayHost`, and canvas ref. Children mount when the
runtime is ready; the component owns their runtime's lifecycle.

## Google Maps testbed

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

Open `/dev/google-maps` to search for places, inspect click coordinates and camera
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

The browser key needs **Maps JavaScript API** and **Places API (New)**, with HTTP
referrer restrictions for the app. Routes use a separate server key with
**Routes API** enabled. Copy `backend/.env.example` to `backend/.env.local`, set
`GOOGLE_ROUTES_API_KEY`, and restart `npm run dev`. The backend loads this file
relative to its own directory; existing process environment values take priority.
Do not prefix the server key with `VITE_`. For deployment, set the same variable
in the host's `~/.config/jjs/deploy.env`; Compose passes it only to the backend.
Use server-appropriate restrictions (such as the server's outbound IP), not
HTTP referrers. All features still call real Google APIs.

`GooglePlaceSearch` uses the new `PlaceAutocompleteElement` and returns a
`MapPlace` through `onSelect`. `src/maps/googleDirections.ts` calls
`POST /api/routes`; request/response schemas and types live in `@trasolve/shared`.
Google Maps backend code lives in `backend/src/google/maps/routes.ts`: the single
`Routes` class handles HTTP, validates requests, calls Google REST, and normalizes
responses. `ApiError` in `errors.ts` defines API errors.
`backend/src/instances.ts` loads the environment and creates one `Routes` instance
per Node.js process. Backend consumers import only `API` from that module and use
`API.Route.getDirections(input)` or `API.Route.handle(request, response)`.
Both facade objects are frozen. Lint rules reject direct implementation imports
outside the Maps module and instance wiring, and reject value imports of `Routes`
inside the Maps implementation. `Routes` receives its API key and optional timeout (default 15000ms) through its
constructor; request construction and response normalization are private methods.
Requests support tagged address, coordinate, and place-ID endpoints, travel mode,
up to 25 intermediate waypoints (except transit), and alternative routes.
Google does not return alternatives when intermediates are supplied.
The testbed exposes travel mode and alternative-route controls.
Only the autocomplete feature loads the Places SDK library; routing does not
load a browser SDK. The existing `/map` itinerary is not yet connected to routing.

```ts
await getDirections({
  origin: { type: 'place', placeId: selectedPlace.id },
  destination: { type: 'coordinates', lat: 35.6586, lng: 139.7454 },
  travelMode: 'DRIVING',
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
