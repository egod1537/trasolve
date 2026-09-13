# Map visual regions

The visual-region refactor starts from commit
`0e57cabbbd0da456b2ec7f4dafc23a32ca200e82` on `impl`.

```text
MapPage (class route root, catalog and picker)
├─ TripSession → TripProvider → MapWorkspace (mapping, selection and composition)
│  ├─ LayerPanel
│  │  ├─ LayerPanelHeader
│  │  ├─ LayerPanelContent
│  │  │  └─ DayLayerSection → PlaceLayerItem / PolylineLayerItem
│  │  └─ LayerPlaceDetailCard / LayerPolylineDetailCard
│  ├─ MapViewport
│  │  ├─ GoogleMapView → GoogleMap / TripLayer
│  │  ├─ MapSearchToolbar
│  │  └─ BottomContextPanel + MapToolPanel
│  └─ MapAiRegion
│     ├─ MapAiButton
│     └─ MapAiPanel
└─ TripPickerPopup
```

LayerPanel retains the aside ref and busy state boundary. Content owns collapse
state, scroll ref, selected-item reveal and the shared `usePlaceReorder` binding,
reporting results through `onMovePlace`. DayLayerSection renders Place and derived
RouteSegment rows from `Day.layerItems`; only Place rows own a drag handle.
RouteSegment order and endpoints are reconciled from adjacent Place pairs after a
drop. Row bodies update selection, while their shared chevron control opens the
corresponding layer detail card.

MapViewport provides a relative wrapper with the same full canvas dimensions as
before. The floating LayerPanel still overlays the canvas: physically shrinking the
canvas would change the existing camera padding. The original sidebarRef points to
the LayerPanel aside, so GoogleMapView keeps measuring the same panel geometry.
GoogleMapView still owns camera effects and TripLayer; the viewport never creates
SDK objects or mutates trip data. MapSearchToolbar owns discovery controls while
BottomContextPanel shows a compact, non-interactive Day or Place context summary.
RouteSegment object selection remains independent and never replaces that context.
Its sibling MapToolPanel remains visible independently of selection and contains
the global map-tool entry points. The Google canvas still fills the original
viewport. Opening AI adjusts only the floating-control allowance or visibility.

MapWorkspace shares only the aiOpen boolean between MapViewport and MapAiRegion.
MapAiRegion owns toggle/close wiring, the button ref and focus restoration. Its
full-size positioning wrapper has pointer-events:none; the visible button and open
panel retain pointer interaction. The wrapper adds no stacking context. MapAiPanel
stays mounted on close, preserving chat history, Markdown and export behavior.

Region root classes are layer-panel, layer-panel-scroll, day-layer-section,
place-layer-item, map-viewport and map-ai-region. Existing trip-* classes and mobile
breakpoints remain to preserve visuals and drag/camera behavior. The unused
MapSearchBar and its styles were removed; MapSearchToolbar is the map search UI.

The region folders cannot directly import API clients, controllers, stores or SDK
infrastructure. Components receive callbacks and render the existing specialized
components. The domain, rendering controller, APIs and picker ownership are unchanged.

Browser review should cover collapse, selection/reveal, pointer/keyboard reorder,
map focus/pan/zoom, resize/mobile geometry, toolbar, AI close focus/history/export,
picker and StrictMode cleanup. Browser launch in this session was previously rejected
by tool policy, so those manual checks remain unverified for this refactor.
