# Map visual regions

The visual-region refactor starts from commit
`0e57cabbbd0da456b2ec7f4dafc23a32ca200e82` on `impl`.

```text
MapPage (class, owns Store/Controller)
└─ TripMapsWorkspace (catalog and picker)
   ├─ MapWorkspace (mapping, selection and composition)
   │  ├─ LayerPanel
   │  │  └─ DayLayerSection
   │  │     └─ PlaceLayerItem → PlaceDragHandle
   │  ├─ MapViewport
   │  │  ├─ GoogleMapView → GoogleMap / TripMapLayer
   │  │  └─ MapToolbar
   │  └─ MapAiRegion
   │     ├─ MapAiButton
   │     └─ MapAiPanel
   └─ TripMapPickerDialog
```

LayerPanel owns the existing collapse state, scroll ref, selected-item reveal and
usePlaceReorder binding. It only reports reorder results through onMovePlace.
DayLayerSection owns day headings, collapse controls and the unchanged drop-indicator
calculation. PlaceLayerItem owns the place row, its drag handle and presentation.
The drag algorithm and its data attributes / trip-place-item selector are unchanged.

MapViewport provides a relative wrapper with the same full canvas dimensions as
before. The floating LayerPanel still overlays the canvas: physically shrinking the
canvas would change the existing camera padding. The original sidebarRef points to
the LayerPanel aside, so GoogleMapView keeps measuring the same panel geometry.
GoogleMapView still owns camera effects and TripMapLayer; the viewport never creates
SDK objects or mutates trip data. A tools grid column beside LayerPanel supplies
MapToolbar's positioning boundary. It uses the existing panel-width variable;
MapToolbar has no panel-width calculation and starts at a local 16px inset. Its
720px maximum width shrinks to the available column width. The Google canvas still
fills the original viewport. On mobile the tools column spans the viewport and
the toolbar uses 12px side insets. Opening AI adjusts only the right allowance or
visibility, leaving the left anchor fixed.

MapWorkspace shares only the aiOpen boolean between MapViewport and MapAiRegion.
MapAiRegion owns toggle/close wiring, the button ref and focus restoration. Its
full-size positioning wrapper has pointer-events:none; the visible button and open
panel retain pointer interaction. The wrapper adds no stacking context. MapAiPanel
stays mounted on close, preserving chat history, Markdown and export behavior.

Region root classes are layer-panel, layer-panel-scroll, day-layer-section,
place-layer-item, map-viewport and map-ai-region. Existing trip-* classes and mobile
breakpoints remain to preserve visuals and drag/camera behavior. The unused
MapSearchBar and its styles were removed; MapToolbar is the only map search UI.

The region folders cannot directly import API clients, controllers, stores or SDK
infrastructure. Components receive callbacks and render the existing specialized
components. The domain, rendering controller, APIs and picker ownership are unchanged.

Browser review should cover collapse, selection/reveal, pointer/keyboard reorder,
map focus/pan/zoom, resize/mobile geometry, toolbar, AI close focus/history/export,
picker and StrictMode cleanup. Browser launch in this session was previously rejected
by tool policy, so those manual checks remain unverified for this refactor.
