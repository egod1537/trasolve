# Analytics flow aggregation

`aggregateAnalyticsFlow()` converts validated raw events into deterministic
session paths and provider-neutral node, edge, and summary DTOs. It accepts an
array, a synchronous iterator, or an asynchronous repository iterator.

## Node modes

- `mixed` (default): `screen_view` becomes a screen node and domain events
  (`add_place`, `remove_place`, `optimize_start`, `optimize_complete`,
  `result_view`, `share_enable`, `share_link_copy`, and `shared_trip_view`)
  become event nodes. `button_click` is treated as intent data and is not a
  flow node.
- `screen`: every event maps to its screen node.
- `domain_event`: only the domain events listed above become nodes.

Node IDs use `screen:<screen>` and `event:<eventType>`. Events are grouped by
session and ordered by `timestamp`, then event ID. Nodes and edges are sorted by
their stable IDs so input iteration order does not affect the result.

`collapseConsecutiveNodes` defaults to `true`. When enabled, consecutive equal
nodes inside one session path are reduced to one occurrence before node and edge
metrics are calculated.

Each edge reports occurrence count, count divided by all outgoing transitions
from its source, and distinct session count. Empty input, sessions with no nodes
in the selected mode, and single-node sessions produce valid summaries without
synthetic edges.
