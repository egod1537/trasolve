# Map tools

The opened-trip toolbar contains history, pan, distance, polygon area, optimization,
and a separate camera action. The trip picker opens trips through their title or
preview; its redundant folder button is removed and delete is red.

Distance mode adds a vertex for each map click, displays segment and total distance,
and uses m/km. Area mode automatically closes a polygon after three vertices and
uses m²/km². Draggable numbered vertices update the result after a drag. Undo removes
the last vertex, Clear removes all, and Escape/Close returns to pan. Switching modes
or opening optimization discards the temporary measurement. None of these actions
writes trip data, enters trip history, or calls a route/places service.

Geometry uses a spherical Earth (mean radius 6,371,008.8 m), with wrapped longitude
deltas and the smaller enclosed spherical area. Intersecting rings show a correction
hint rather than a misleading area. These are geographic estimates, not surveying
measurements. Provider objects remain inside map adapters; the UI only consumes
provider-neutral draggable-marker and polygon contracts.

## Screenshot behavior

The camera lazily loads html2canvas-pro and downloads the visible application viewport
as a timestamped PNG, including the sidebar and overlays. It does not upload a screenshot.
A regular DOM view downloads immediately. Canvas-backed maps require native screen
capture because their buffers can be cleared or protected; the browser's mandatory
picker asks for the current tab, then the PNG is saved automatically and every stream
track is stopped. Audio is never requested. Cancelling the picker returns to the map.
Capture is locked during processing and object URLs are revoked after download.

Browser capture permissions cannot be persisted or bypassed by an ordinary web page.
Browsers lacking display capture report a localized error for canvas-backed views.
External raster assets also require their origin's CORS permission for DOM capture.

## Verification

- Workspace typecheck, architecture check, localization lint, lint and production build.
- Local browser: trip card without folder action, red delete icon, distance/area toolbar,
  measurement panel and Escape, PNG download and inspected PNG content.
- Optimization dialog: remaining number and gauge, Run reaches the normal API error when
  the local route server is unconfigured, no checkout error inside the dialog.
- Maps credentials and a troute endpoint are absent in the local preview. Actual map
  click/drag rendering and end-to-end route computation require that configured environment.
