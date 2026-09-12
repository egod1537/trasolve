# Frontend Trip sessions and rendering

Trip is travel domain data: title, dates, days, places, polylines, their shared
layer item order, memos and optional minute-based visit duration. Map is
rendering infrastructure: camera and drawable objects. TripLayer binds the two.
Map infrastructure never imports Trip or page features.

## Composition and ownership

MapPage is the class route root and owns repository/catalog orchestration. No
TripStore, TripEditController or TripProvider exists before the user selects a trip.

    MapPage: repository, catalog and selection requests
    ├─ TripPickerPopup: presentation and callbacks
    └─ TripSession: one selected Trip
       ├─ TripStore
       ├─ TripEditController → TripRepository.saveTrip
       └─ TripProvider → MapWorkspace
                         ├─ LayerPanel
                         ├─ MapViewport → GoogleMapView → TripLayer
                         └─ MapAiRegion

MapPage constructs one HttpTripRepository. Frontend TripRepository exposes
listTrips, getTrip, createTrip, saveTrip and deleteTrip with AbortSignal support.
Lists retain the existing Trip[] response. HttpTripRepository wraps pages/map/api/trips.ts,
which retains fetch, timeout, error normalization and shared schema validation.
Application code depends on the repository contract; the old TripApi object is
removed. Backend TripRepository is a separate server storage contract. Neither
HTTP nor persisted format changes.

The picker receives callbacks only. MapPage loads or creates a canonical Trip,
then mounts TripSession. Each selection gets a session key; selecting another ID
or explicitly reloading the same ID replaces the session. Failure leaves the current
session intact. Delete clears a matching selection and refreshes the catalog.
MapPage owns catalogLoading/catalogError and opening/creating/deleting status
with separate action errors and request cancellation. It does not edit trip internals.
Its selectedTrip snapshot only initializes a session; live edits remain in TripStore.

TripSession creates the store and edit controller in a lazy state initializer.
TripProvider passes their stable Context value. Constructors perform no I/O or
subscriptions; discarded StrictMode initializations leak no resources. Session
unmount cancels pending edits. Idempotent cancellation permits StrictMode effect
cleanup/setup to reuse the session. useTripState (useSyncExternalStore) and
useTripEditController are session-only; MapPage and the picker do not call them.

## Store and edits

createTripStore(initialTrip) validates and detaches a required Trip, prepares
visiting-order route geometry and starts ready. Trip is non-null; state contains
trip, routes, ready/saving/error status and error. Snapshots are recursively frozen
and stable until setState publishes a detached copy. Store performs no HTTP work.
MapWorkspace subscribes to the live store rather than the initial selection snapshot;
both LayerPanel and TripLayer receive optimistic and canonical changes.

TripEditController binds to the initial Trip ID and exposes save, renameTrip,
addDay, moveDay, addPlace, removePlace, movePlace, updatePlace, updateMemo,
updateTimeRange, updatePolylineMode and cancelPending.
List/load/create/delete/close belong outside it. Dependencies are TripStore,
TripRepository and provider-neutral domain helpers, never React or map objects.

Mutations structuredClone the snapshot, reconcile RouteSegments from the Day's
adjacent Place pairs, validate the shared schema and publish saving state
immediately. `moveDay` and `movePlace` accept zero-based target indices. Only Place
rows are draggable; each reorder and its route reconciliation are one mutation.
Concurrent edits return
false while one mutation is pending. Temporary optimistic nested IDs use the
`pending-*` namespace so the backend can replace them with canonical IDs while
remapping layer item references; known IDs and optional fields persist.
Repository.saveTrip sends TripInput through the existing whole-trip PUT endpoint.
Success publishes the canonical result with ready status. A mismatched response ID
is rejected. Failure restores domain and route snapshots and reports an error.
save() uses the same pipeline without introducing an additional edit.

cancelPending aborts the request, restores its snapshot and detaches request identity.
Late completion cannot update canceled/replaced sessions. MapPage separately aborts
catalog/action requests on unmount. Abort does not guarantee a server write was
canceled; reopening retrieves persisted state.

tripToRoutes supplies the same straight visiting-order geometry for initialization
and edits. Rollback restores matching geometry. Future road-route invalidation
belongs in the edit controller/backend, never TripLayer.

## Rendering and UI

TripLayer still takes Trip, routes, selection and MapObjectController. Marker handles
remain keyed by place ID and polylines by day ID; setters update existing objects,
and missing IDs remove handles/listeners. Cleanup removes only owned
itinerary-markers/itinerary-route objects. GoogleMapView, camera policy, native
marker positioning and map object lifecycle are unchanged.

Selection/camera stay in useMapUi. Place order is structural source data;
RouteSegments and the interleaved `Day.layerItems` representation are normalized
from it. RouteSegment rows remain selectable and their mode remains editable, but
they are neither draggable nor directly drawable. Collapse, AI visibility/chat and
drag previews are not persisted.

GooglePlaceCard is the discovery card for a native Google POI. TripPlaceCard is a
separate management card for a persisted Trip place and edits duration only through
TripEditController. Both share PlaceOpeningHours and the same absolute overlay slot,
but MapViewport renders at most one card. Google place details remain external data;
the selected canonical fields are written into TripInput.

The picker blocks background interaction above the existing map. Without selection,
a reusable GoogleMap supplies the background and the popup cannot be dismissed.
Load/create success closes it; failure keeps it open. X/Escape only dismiss when a
trip exists and no catalog action is pending. No replacement toolbar control reopens
the picker after selection. Picker deletion calls MapPage and ends a matching session.
MapSearchToolbar placement, AI focus/history/Markdown/export and Place drag behavior remain.

## Manual verification

Use the real /map UI and backend: confirm no Provider before selection, load/create,
initial routes, Place-only pointer/keyboard reorder, adjacent route reconciliation,
reload persistence, route mode edits, optimistic place edits, failed-save rollback, session switch,
unmount cancellation and deletion. Disconnect browser networking for failures, then
reopen to retrieve canonical state. No test-only branches, fake providers, automated
tests or fixtures are added. HTTP/static checks do not replace browser lifecycle,
focus, map interaction and StrictMode verification.
