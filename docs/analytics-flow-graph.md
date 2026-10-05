# Analytics directed flow graph

The Flow Graph view consumes `GET /api/analytics/flows` through the shared
frontend analytics API. Its UI implementation lives in the
`features/analytics-flow` slice and does not access storage or call `fetch`
directly.

## Rendering

- Cytoscape.js owns the interactive canvas, zoom, pan, and selection state.
- Up to 30 nodes use the left-to-right `dagre` layout with greedy cycle
  handling. Larger graphs fall back to Cytoscape's `cose` layout.
- Nodes show a presentation-provided label, stable identifier, visit count, and
  unique-session count.
- Edges show occurrence count and outgoing ratio. Their width scales with
  occurrence frequency and a target arrow shows direction.
- Selecting a node or edge exposes its metrics in the adjacent detail panel.
- A `ResizeObserver` keeps the canvas fitted when its responsive container
  changes size.

## Filters and states

The initial controls cover browser-local `from`/`to` values, minimum count, and
the `mixed`, `screen`, and `domain_event` node modes. Local date-time values are
converted to UTC ISO 8601 values at the API boundary. The component presents
separate loading, error/retry, and empty states.

All user-visible labels and node display-name resolution are injected by the
presentation page. Stable analytics identifiers remain unmodified. This keeps
localization out of the graph engine and preserves analytics continuity.
