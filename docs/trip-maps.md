# Trip persistence

`Frontend TripRepository → HttpTripRepository → api/trips.ts → backend TripHttpService → TripController → TripRepository`
is the persistence boundary. Rendering remains separate through MapObjectController.

The Trip terminology is an internal type/module naming convention. HTTP paths and
the data directory are unchanged. Trip places keep visit timeline length in
`visitDurationMinutes` and the independently editable preferred stay in
`preferredDurationMinutes`. Legacy `durationMinutes` data migrates only to
`visitDurationMinutes`; no preferred stay is inferred. Existing local files without
`layerItems` are migrated in memory when parsed and persist the generated shared
order on their next save.

## Domain and commands

`shared/schemas/trip.ts` validates the domain; `shared/types/trip.ts` exports
Trip, TripInput, TripDay, TripPlace, TripPolyline and TripLayerItem. Stored data
includes owner, title, optional ISO dates, days (including color), places (location,
order, optional Google placeId/address/memo/time/visitDurationMinutes/
preferredDurationMinutes), polylines, the shared `layerItems` display order, and UTC
createdAt/updatedAt timestamps. Both durations are stored independently in minutes
from 0 through 1440; omission means that the user has not set that value.

TripController exposes listTrips, getTrip, createTrip, saveTrip and deleteTrip.
It imports only the repository interface. All modifications, including future AI
commands, must go through this controller. The initial API uses whole-trip PUT;
fine-grained add/move/update command endpoints are not implemented yet.

The backend generates canonical trip/day/place/polyline UUIDs on creation. PUT
preserves known nested IDs and accepts frontend-only `pending-*` IDs while creating
new nested entities; other unknown or duplicated existing IDs are rejected. The
`Day.layerItems` array is authoritative for the combined Place/Polyline sidebar
order. Place and Polyline arrays retain consecutive type-local `order` values for
their existing map and visit semantics.
createdAt is preserved and updatedAt is advanced by the backend. Neither timestamp
nor userId belongs in an input body. PUT replaces the editable snapshot, so omitted
optional fields are removed and omitted days/places are deleted.

## HTTP contract

| Method | Endpoint             | Success                          |
| ------ | -------------------- | -------------------------------- |
| GET    | `/api/trips`         | 200, Trip[] for the current user |
| POST   | `/api/trips`         | 201, created Trip                |
| GET    | `/api/trips/:tripId` | 200, Trip                        |
| PUT    | `/api/trips/:tripId` | 200, saved Trip                  |
| DELETE | `/api/trips/:tripId` | 204, no body                     |

POST/PUT accept TripInput as JSON, for example:

```json
{
  "title": "도쿄 여행",
  "startDate": "2026-10-12",
  "endDate": "2026-10-14",
  "days": [
    {
      "title": "Day 1",
      "date": "2026-10-12",
      "color": "#2563eb",
      "places": [
        {
          "name": "Tokyo Tower",
          "location": { "lat": 35.6586, "lng": 139.7454 },
          "memo": "저녁에 방문",
          "time": "18:00",
          "visitDurationMinutes": 60,
          "preferredDurationMinutes": 90
        }
      ]
    }
  ]
}
```

Input bodies are strict objects, limited to 2MiB, 100 days and 500 places per day.
IDs must match `^[a-zA-Z0-9_-]{1,128}$`. Dates and coordinates are validated. All
responses use `Cache-Control: no-store`. Errors expose only `{error:{code,message}}`:
400 INVALID_TRIP_REQUEST, 401 AUTHENTICATION_REQUIRED, 404 TRIP_NOT_FOUND, 405 METHOD_NOT_ALLOWED,
409 TRIP_REVISION_CONFLICT/TRIP_ALREADY_EXISTS, 413 REQUEST_TOO_LARGE,
415 UNSUPPORTED_MEDIA_TYPE, 503 TRIP_STORAGE_UNAVAILABLE.
Get/delete of missing trips return 404; the low-level repository delete ignores
ENOENT. Filesystem paths, contents and stack traces are not returned to clients.

## Storage and current user

index.ts and instances.ts form the composition root:

```text
DB session → CurrentUserResolver
PostgresTripRepository → TripController
  → TripHttpService(controller, currentUserResolver)
```

PostgreSQL is the production Trip source of truth. Stable metadata lives in
columns and versioned editable content lives in `trips.document` JSONB. The
repository validates `StoredTripV1` before writes and after reads. It maps DB
metadata back into the existing Trip DTO without duplicating it in JSONB.

`CurrentUserResolver` parses the HttpOnly session cookie and resolves it through
the PostgreSQL session repository. Missing, expired, revoked and deleted-user
sessions return 401; there is no local-user fallback. Repository methods receive
the authenticated actor ID separately from the Trip owner field. The current
file repository implements owner-only access and verifies that loaded records
match both owner and trip ID, so inaccessible trips are returned as 404. Existing
`local-user` files are not assigned to the first login user and remain untouched
until an explicit data migration is run.

Update and soft delete include actor ownership, expected bigint revision and
`deleted_at IS NULL` in the SQL predicate. The revision trigger advances successful
writes and zero-row writes are classified as stale or inaccessible/missing. The
controller still queues same-process mutations; PostgreSQL optimistic locking covers
other processes. Single Trip GET/POST/PUT responses expose the bigint revision as a
strong ETag. PUT and DELETE require that value in If-Match; missing preconditions are
428 and stale revisions on accessible trips are 412. DELETE also returns its advanced
revision as an ETag.

`LocalFileTripRepository` remains as a rollback and migration source only. Runtime
does not instantiate it and never dual-writes. Existing files under
`.local/trasolve/users` or the deployment data volume remain untouched until an
explicit owner-mapped migration is run.

## Frontend

`/map` lists stored trips and supports an empty state. New-trip creation is explicit;
the optional Tokyo example button submits sample content through the same API and
receives canonical server IDs. No automatic seed runs inside the repository.
The initial picker supports trip selection and creation; the map sidebar supports
day drag/drop and one shared Place/Polyline drag/drop order. Place items may retain
their existing cross-day move behavior; polylines remain in their owning day so
`fromPlaceId` and `toPlaceId` continue to reference that day's places. The
persistence toolbar and place editor are no longer exposed.
TripEditController commands for title, places, coordinates/memos, visit duration,
preferred duration and days remain available. Trip deletion belongs to MapPage and
is exposed in the picker.
Mutations still use the existing APIs; dates and other fields are preserved.

`HttpTripRepository` owns ETag metadata so components never handle HTTP revisions.
It serializes writes per Trip and captures each request's revision before waiting, so
a queued stale save cannot reuse an earlier save's newer ETag. On 412 it does not retry
the PUT: it reloads the latest server Trip, updates the revision cache and surfaces a
conflict to `TripEditController`. The controller replaces the stale local snapshot,
clears its undo history, stops any automatic follow-up save and displays the conflict.

`src/pages/map/domain/tripMapping.ts` maps persisted data to the existing map view
types; the sample creation helper maps the example to an API input. TripStore
holds a non-null snapshot only inside the selected TripSession. TripEditController applies optimistic mutations,
then replaces them with the server response or rolls back on failure. Opening a trip
fetches it through the frontend repository and mounts a new TripSession/TripProvider.
Frontend TripRepository describes HTTP persistence; backend TripRepository describes
server storage. MapPage creates no store or edit controller before selection.
Selection, sidebar state, AI panel
visibility, drag previews and chat messages are never included in TripInput.
The API client validates request/response schemas and supports AbortSignal/timeouts.

See [Frontend Trip state and binding](frontend-trip-map.md) for store/controller/
renderer ownership. The backend controller and persistence contracts remain unchanged.

## PostgreSQL replacement

Implement TripRepository in PostgresTripRepository, retaining user-scoped
list/get/save/delete semantics. Replace repository construction in instances.ts.
TripController, HTTP contracts, shared types and frontend need no storage-specific
changes. Add database transactions/versioning when expanding concurrency support.

## Verification

Use actual HTTP, browser interaction and filesystem inspection; do not add automated
test files, mocks or test dependencies. Check creation, restart/reload, edits, deletion,
owner isolation, malformed requests, corrupted file errors and consecutive saves.
Use an isolated data directory for intentional corruption checks. Run lint, typecheck
and build. Docker deployment requires separate verification on a Docker host.
