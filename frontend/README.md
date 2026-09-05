# Travel map

The landing page links to `/map`, a full-screen Google Maps itinerary view.
The sample trip is in `src/data/demoTrip.ts`; it does not require the backend.
Selection lives in `MapPage`, while SDK loading and map operations are isolated in
`src/maps/googleMaps.ts` and `src/components/map/`.

## Local setup

Copy `frontend/.env.example` to `frontend/.env.local`, then set
`VITE_GOOGLE_MAPS_API_KEY` to a browser key with Maps JavaScript API enabled and
billing configured. Restrict it to Maps JavaScript API and the HTTP referrers used
by the app (including the local development origin). Set
`VITE_GOOGLE_MAPS_MAP_ID` to a JavaScript map ID; `DEMO_MAP_ID` is the development
fallback for Advanced Markers. Restart `npm run dev` after changing the file.

These are Vite build-time inputs, so a production build needs the variables
available when Vite runs. Changing container runtime variables alone does not
change the built client. This change does not modify the deployment infrastructure.

Without a key or if Google Maps fails to load, the page keeps the itinerary usable
and shows a map connection message; it does not substitute a fake map.
Search is a disabled UI placeholder. The route lines connect each day's places
by `order`, and are not road routes or travel-time estimates. `TripRoute.path`
accepts coordinate arrays so a future Routes API adapter can supply the geometry
without changing itinerary selection or marker components.

Manual checks with a configured key: open `/map`, select a place in the sidebar,
click a marker, collapse its Day then select that marker again, select a Day,
and use “전체 일정 보기”. Verify markers remain clear of the panel, and that dragging,
wheel/pinch zoom and double-click zoom work. On narrow screens the itinerary
becomes a lower panel, leaving the native zoom controls and attribution accessible.

References: [API loading](https://developers.google.com/maps/documentation/javascript/load-maps-js-api),
[Advanced Markers](https://developers.google.com/maps/documentation/javascript/advanced-markers/start),
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
