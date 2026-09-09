# Frontend source layout

Top-level folders: app, pages, map, api, shared, assets.

Before: adapters, api, assets, components, controllers, data, domain, hooks, maps,
pages, stores, styles, types, utils (14 folders). After: six folders. The eleven
obsolete technical-layer directories were removed once empty. No dependencies or
aliases were added, and routes and public API contracts are unchanged.

```text
src/
├─ app/                 App, main, routes, buildInfo
├─ pages/
│  ├─ map/
│  │  ├─ MapPage.tsx
│  │  ├─ components/    workspace, picker, layer-panel, viewport, ai
│  │  ├─ controller/    TripMapController
│  │  ├─ store/         TripMapStore, factory, Provider
│  │  ├─ hooks/         selection, store binding, reorder
│  │  ├─ domain/        camera policy, mapping, trip/UI types, bounds helper
│  │  ├─ api/           trips.ts
│  │  ├─ data/          demoTrip
│  │  └─ styles/
│  ├─ landing/          page, components, styles
│  └─ testbed/          three page roots, Google Maps components, hooks, styles
├─ map/
│  ├─ adapters/         provider-neutral contracts and Google implementations
│  ├─ runtime/          Google SDK loader and runtime factory
│  ├─ components/       reusable GoogleMap and canvas styles
│  ├─ types/            map primitives and React map component contracts
│  ├─ hooks/            useMapPolyline runtime binding
│  └─ geometry/         existing provider-neutral culling helpers
├─ api/                 chat, places, routes, health
├─ shared/
│  ├─ components/chat/  MapAiPanel, Markdown rendering and their styles
│  ├─ utils/            chat Markdown export/download
│  └─ styles/           global reset/tokens
└─ assets/              existing images
```

MapAiPanel is shared by /map and /testbed/ai-chat, so it does not live under either
page. Markdown rendering, export and chat CSS follow that shared consumer. The
map-specific AI button/region remain under pages/map. Shared contains no speculative
UI library or new store. GooglePlaceSearch and useDirectionsState are currently
testbed-only and move there. GoogleMap and its primitive lifecycle binding remain
map infrastructure used by both map and testbed.

The top-level api folder is the existing common Web Service client boundary:
chat serves both chat surfaces, places/routes supply reusable Google data requests,
and health represents app connectivity. trips.ts is currently map-feature-only and
moves beside its controller. API logic is unchanged.

MapFocus/MapFocusTarget were extracted to pages/map/domain/mapUiTypes.ts so map
primitives no longer contain page selection state. Existing declarations were
moved without changing their shapes. AI panel CSS was extracted from map.css to
shared chat-panel.css; Places search CSS was extracted from the Google canvas CSS
to testbed/styles/google-place-search.css. Selectors and declarations are preserved.

Imports point explicitly at their new owners; no barrels or aliases were added.
Lint boundaries now address the new paths, including the page-specific trips client.
Map/shared/api cannot import pages. The plain controller/store still cannot import
React or rendering bindings, and visual regions retain their existing restrictions.

Validation: lint, typecheck and production build pass. A static relative-import
graph review of 86 modules found no unresolved imports, cycles (including type
imports), or map/shared/api references to pages. A before/after source comparison
found only path changes except the documented type/CSS extraction and CSS import
adjustments. No automated test files, fixtures, scripts or dependencies were added.
Browser behavior remains unverified: browser launch in this session was previously
rejected by tool policy. The original map, chat and testbed manual checklist still
applies after moving files.

## File moves

| Before (frontend/) | After (frontend/) |
| --- | --- |
| `src/utils/chatMarkdown.ts` | `src/shared/utils/chatMarkdown.ts` |
| `src/types/trip.ts` | `src/pages/map/domain/trip.ts` |
| `src/styles/trip-maps.css` | `src/pages/map/styles/trip-maps.css` |
| `src/styles/testbed.css` | `src/pages/testbed/styles/testbed.css` |
| `src/styles/map.css` | `src/pages/map/styles/map.css` |
| `src/styles/map-toolbar.css` | `src/pages/map/styles/map-toolbar.css` |
| `src/styles/landing.css` | `src/pages/landing/styles/landing.css` |
| `src/styles/google-maps-test.css` | `src/pages/testbed/styles/google-maps-test.css` |
| `src/styles/global.css` | `src/shared/styles/global.css` |
| `src/styles/ai-chat-test.css` | `src/pages/testbed/styles/ai-chat-test.css` |
| `src/stores/TripMapStore.ts` | `src/pages/map/store/TripMapStore.ts` |
| `src/stores/TripMapProvider.tsx` | `src/pages/map/store/TripMapProvider.tsx` |
| `src/stores/createTripMapStore.ts` | `src/pages/map/store/createTripMapStore.ts` |
| `src/routes.tsx` | `src/app/routes.tsx` |
| `src/pages/TestbedPage.tsx` | `src/pages/testbed/TestbedPage.tsx` |
| `src/pages/MapPage.tsx` | `src/pages/map/MapPage.tsx` |
| `src/pages/LandingPage.tsx` | `src/pages/landing/LandingPage.tsx` |
| `src/pages/GoogleMapsTestPage.tsx` | `src/pages/testbed/GoogleMapsTestPage.tsx` |
| `src/pages/AiChatTestPage.tsx` | `src/pages/testbed/AiChatTestPage.tsx` |
| `src/maps/googleMaps.ts` | `src/map/runtime/googleMaps.ts` |
| `src/maps/createGoogleMapRuntime.ts` | `src/map/runtime/createGoogleMapRuntime.ts` |
| `src/main.tsx` | `src/app/main.tsx` |
| `src/hooks/usePlaceReorder.ts` | `src/pages/map/hooks/usePlaceReorder.ts` |
| `src/hooks/useDirectionsState.ts` | `src/pages/testbed/hooks/useDirectionsState.ts` |
| `src/hooks/map/useTripMap.ts` | `src/pages/map/hooks/useTripMap.ts` |
| `src/hooks/map/useMapUi.ts` | `src/pages/map/hooks/useMapUi.ts` |
| `src/hooks/map/useMapPolyline.ts` | `src/map/hooks/useMapPolyline.ts` |
| `src/buildInfo.ts` | `src/app/buildInfo.ts` |
| `src/domain/map/tripMapMapping.ts` | `src/pages/map/domain/tripMapMapping.ts` |
| `src/domain/map/mapTypes.ts` | `src/map/types/mapTypes.ts` |
| `src/domain/map/geometry.ts` | `src/pages/map/domain/geometry.ts` |
| `src/domain/map/culling.ts` | `src/map/geometry/culling.ts` |
| `src/domain/map/cameraPolicy.ts` | `src/pages/map/domain/cameraPolicy.ts` |
| `src/controllers/TripMapController.ts` | `src/pages/map/controller/TripMapController.ts` |
| `src/data/demoTrip.ts` | `src/pages/map/data/demoTrip.ts` |
| `src/api/trips.ts` | `src/pages/map/api/trips.ts` |
| `src/adapters/map/MapRuntime.ts` | `src/map/adapters/MapRuntime.ts` |
| `src/adapters/map/MapOverlayHost.ts` | `src/map/adapters/MapOverlayHost.ts` |
| `src/adapters/map/MapObjectController.ts` | `src/map/adapters/MapObjectController.ts` |
| `src/adapters/map/MapAdapter.ts` | `src/map/adapters/MapAdapter.ts` |
| `src/adapters/map/map-objects.css` | `src/map/adapters/map-objects.css` |
| `src/adapters/map/GoogleOverlayHost.ts` | `src/map/adapters/GoogleOverlayHost.ts` |
| `src/adapters/map/GoogleMapObjectController.ts` | `src/map/adapters/GoogleMapObjectController.ts` |
| `src/adapters/map/GoogleMapAdapter.ts` | `src/map/adapters/GoogleMapAdapter.ts` |
| `src/components/chat/ChatMarkdown.tsx` | `src/shared/components/chat/ChatMarkdown.tsx` |
| `src/components/chat/chat-markdown.css` | `src/shared/components/chat/chat-markdown.css` |
| `src/components/google-map/google-map.css` | `src/map/components/google-map.css` |
| `src/components/google-map/types.ts` | `src/map/types/googleMapComponent.ts` |
| `src/components/google-map/GooglePlaceSearch.tsx` | `src/pages/testbed/components/google-maps/GooglePlaceSearch.tsx` |
| `src/components/google-map/GoogleMap.tsx` | `src/map/components/GoogleMap.tsx` |
| `src/components/google-maps-test/Coordinates.tsx` | `src/pages/testbed/components/google-maps/Coordinates.tsx` |
| `src/components/google-maps-test/config.ts` | `src/pages/testbed/components/google-maps/config.ts` |
| `src/components/google-maps-test/DebugPanel.tsx` | `src/pages/testbed/components/google-maps/DebugPanel.tsx` |
| `src/components/google-maps-test/DirectionsPanel.tsx` | `src/pages/testbed/components/google-maps/DirectionsPanel.tsx` |
| `src/components/google-maps-test/types.ts` | `src/pages/testbed/components/google-maps/types.ts` |
| `src/components/google-maps-test/SelectionPanel.tsx` | `src/pages/testbed/components/google-maps/SelectionPanel.tsx` |
| `src/components/google-maps-test/RouteResultPanel.tsx` | `src/pages/testbed/components/google-maps/RouteResultPanel.tsx` |
| `src/components/landing/HeroVisual.tsx` | `src/pages/landing/components/HeroVisual.tsx` |
| `src/components/google-maps-test/MapPanel.tsx` | `src/pages/testbed/components/google-maps/MapPanel.tsx` |
| `src/components/landing/Hero.tsx` | `src/pages/landing/components/Hero.tsx` |
| `src/components/landing/Header.tsx` | `src/pages/landing/components/Header.tsx` |
| `src/components/landing/FeatureSection.tsx` | `src/pages/landing/components/FeatureSection.tsx` |
| `src/components/landing/FeatureCard.tsx` | `src/pages/landing/components/FeatureCard.tsx` |
| `src/components/map/GoogleMapView.tsx` | `src/pages/map/components/viewport/GoogleMapView.tsx` |
| `src/components/map/ai/MapAiRegion.tsx` | `src/pages/map/components/ai/MapAiRegion.tsx` |
| `src/components/map/MapWorkspace.tsx` | `src/pages/map/components/MapWorkspace.tsx` |
| `src/components/map/MapToolbar.tsx` | `src/pages/map/components/viewport/MapToolbar.tsx` |
| `src/components/map/MapAiPanel.tsx` | `src/shared/components/chat/MapAiPanel.tsx` |
| `src/components/map/MapAiButton.tsx` | `src/pages/map/components/ai/MapAiButton.tsx` |
| `src/components/map/viewport/MapViewport.tsx` | `src/pages/map/components/viewport/MapViewport.tsx` |
| `src/components/map/TripMapsWorkspace.tsx` | `src/pages/map/components/TripMapsWorkspace.tsx` |
| `src/components/map/TripMapPickerDialog.tsx` | `src/pages/map/components/TripMapPickerDialog.tsx` |
| `src/components/map/TripMapLayer.tsx` | `src/pages/map/components/viewport/TripMapLayer.tsx` |
| `src/components/map/PlaceDragHandle.tsx` | `src/pages/map/components/layer-panel/PlaceDragHandle.tsx` |
| `src/components/map/layer-panel/PlaceLayerItem.tsx` | `src/pages/map/components/layer-panel/PlaceLayerItem.tsx` |
| `src/components/map/layer-panel/LayerPanel.tsx` | `src/pages/map/components/layer-panel/LayerPanel.tsx` |
| `src/components/map/layer-panel/DayLayerSection.tsx` | `src/pages/map/components/layer-panel/DayLayerSection.tsx` |
| `App.tsx` | `src/app/App.tsx` |
