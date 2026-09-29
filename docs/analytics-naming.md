# Analytics screen and target naming

Analytics identifiers are stable data contracts. They describe a semantic screen or
action independently of the rendered copy and component styling.

## Naming rules

- Use lower-case `snake_case` English identifiers.
- Choose a semantic product concept, not its current visual implementation.
- Read identifiers from `ANALYTICS_SCREENS` and `ANALYTICS_TARGETS` in
  `@trasolve/shared`. Do not duplicate identifier literals in application code.
- Put `data-analytics-id={ANALYTICS_TARGETS.someTarget}` on the actionable DOM
  element when a click or change needs a stable target.
- Put `data-analytics-screen={ANALYTICS_SCREENS.someScreen}` beside it when the
  same target can appear on more than one semantic screen.
- Repeated elements use the same semantic target. Array indexes, database IDs, and
  user-authored values must not become target identifiers.

Do not derive an identifier from translated copy, `textContent`, a CSS class, an
array index, user input, trip/place names, or any other user-provided value.

## Screen inventory

| Identifier           | Owning UI                             | Meaning                                      |
| -------------------- | ------------------------------------- | -------------------------------------------- |
| `landing`            | `LandingPage` at `/`                  | Public landing page                          |
| `map_workspace`      | `MapWorkspace` at `/map`              | Main editable trip map                       |
| `trip_picker`        | `TripPickerPopup`                     | Trip selection and creation dialog           |
| `place_search`       | `MapSearchToolbar` results            | Active place search and result selection     |
| `place_detail`       | `PlaceDetailContent`                  | Selected-place detail surface                |
| `route_optimization` | `RouteOptimizationModal`              | Optimization setup and execution surface     |
| `route_result`       | `RouteOptimizationModal` result state | Completed optimization result and comparison |
| `preferences`        | `PreferencesModal`                    | User preferences dialog                      |
| `share_trip`         | `ShareTripModal`                      | Trip sharing settings dialog                 |
| `shared_trip_viewer` | `PublicSharePage` at `/share/:token`  | Read-only shared trip viewer                 |

The active screen is the most specific visible semantic surface. For example, use
`share_trip` while the share dialog is open rather than its underlying
`map_workspace` screen. Use `route_result` after an optimization result is shown.

## Target inventory

| Identifier          | Element                                     | Intended interaction              |
| ------------------- | ------------------------------------------- | --------------------------------- |
| `landing_login`     | Signed-out landing actions                  | Start login from the landing page |
| `landing_enter_map` | Signed-in landing actions                   | Enter the map workspace           |
| `trip_picker_login` | Signed-out `TripPickerPopup` action         | Start login from the trip picker  |
| `trip_create`       | `TripPickerPopup` create buttons            | Create a new trip                 |
| `trip_select`       | `TripPickerPopup` saved-trip button         | Open a saved trip                 |
| `preferences_open`  | Preferences buttons                         | Open user preferences             |
| `add_place`         | `GooglePlaceCard` add button                | Add the selected place to a trip  |
| `place_search`      | `MapSearchToolbar` search button            | Submit a place search             |
| `place_select`      | `MapSearchToolbar` result button            | Select a place-search result      |
| `place_edit`        | Layer-panel place name                      | Begin editing a saved place       |
| `reorder`           | Layer-panel place drag/keyboard operation   | Reorder a saved place             |
| `remove_place`      | `PlaceDeleteConfirmCard` destructive button | Confirm place removal             |
| `optimize_start`    | `RouteOptimizationModal` run button         | Start or rerun optimization       |
| `optimize_apply`    | `RouteOptimizationModal` apply button       | Apply the selected result         |
| `share_open`        | `LayerPanelHeader` share button             | Open trip sharing settings        |
| `share_toggle`      | `ShareTripModal` public-link checkbox       | Enable or disable link sharing    |
| `copy_share_link`   | `ShareTripModal` copy button                | Copy the generated share link     |

These elements carry `data-analytics-id` using the shared registry value. The
attribute is an identity marker only; event collection is implemented separately.

## Overlay lookup and duplicates

The map Analytics Overlay discovers actionable elements with
`[data-analytics-id]`. It validates both attributes against the shared registries
and joins them to target aggregation by `screen + target`; translated text and
CSS never participate in the lookup.

If a target has no screen attribute, the overlay uses target-only matching only
when the aggregation contains that target on exactly one screen. A target present
on multiple screens without `data-analytics-screen` is treated as ambiguous and
receives a zero marker rather than being assigned potentially incorrect metrics.

Multiple DOM elements may intentionally carry the same `screen + target`, such as
saved-trip rows or alternative trip-creation buttons. Each visible instance shows
the same aggregate metric. Counts are not divided between instances because the
raw event identifies the semantic target rather than a particular rendered copy.
Hidden or zero-size elements do not receive markers.

The overlay aggregates `button_click` events for these markers. `events` is the
click-event count and `sessions` is the unique session count. Domain outcome
events remain separate so intent and successful outcome are not double-counted.

## Adding and renaming identifiers

Add a new identifier to the shared registry before using it in UI code, keep it
semantic and `snake_case`, update this inventory, and use the resulting constant in
the DOM mapping. The analytics event schema rejects screen and target values outside
the registry.

Once collection has started, treat an identifier as immutable. Prefer keeping the
existing identifier through copy, CSS, and component refactors. If the product
meaning truly changes, add a new identifier instead of renaming the old one. When an
unavoidable rename represents the same meaning, preserve an explicit old-to-new
mapping in aggregation logic and record the cutover timestamp so historical queries
remain continuous.
