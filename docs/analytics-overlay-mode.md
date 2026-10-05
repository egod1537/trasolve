# Analytics map overlay mode

The map analytics overlay is a presentation/debug mode activated only by the
exact query value `analytics=1` on `/map`. A missing value, `analytics=0`, and
all other values leave the normal map UI unchanged.

`MapPage` parses the query once with `resolveMapWorkspaceRouteState` and passes
both `mode` and `analyticsMode` into the map-workspace feature. Descendant map,
trip, and overlay components do not read `window.location` or construct their
own `URLSearchParams`. This also allows `readonly=1&analytics=1` without coupling
the two flags.

When enabled, `MapWorkspaceFeatureView` mounts the independent
`features/analytics-overlay` feature next to the existing workspace. The
overlay reads the preceding 24 hours from the Overview API and displays stable
metric identifiers, summary values, and funnel transitions. Refreshing aborts
the previous request and requests a new window. Its floating surface uses the
shared `--shadow-map-overlay` token and adapts to a compact bottom placement on
small screens.

The same response includes `screen + target` click aggregation. The overlay
looks up registered `[data-analytics-id]` controls and positions compact badges
beside visible matches. A MutationObserver reacts to dynamic dialogs and
lists, ResizeObserver handles control size changes, and event-driven scroll and
viewport resize handlers update coordinates. No polling loop is used.

Badges show the target click count and accept pointer input only within their
small pill. Their full-screen positioning layer remains `pointer-events: none`,
so the mapped controls retain their normal hit areas. Clicking a badge opens a
fixed popover with total events, unique sessions, conversion, drop-off,
backtrack, and up to five next transitions. Clicking outside closes it.

The overlay provides compact `1h`, `24h`, and `7d` period controls. Changing the
period or selecting refresh aborts the previous request and retrieves a new
aggregation, which updates both panel metrics and DOM badges.

The query flag is never passed to the backend and grants no permission. The
Analytics read API continues to enforce its own deny-by-default production
access boundary; an unauthorized overlay receives the same API error as any
other client.
