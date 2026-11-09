# External API call control

Trasolve validates `TRASOLVE_EXTERNAL_API_MODE` at backend startup. Its default is
`enabled`, preserving the existing production behavior.

| Mode       | Behavior                                                                                                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`  | Uses the configured Google, AI, troute, and tcache providers.                                                                                                                |
| `disabled` | Rejects immediately before an external call with HTTP 503, `EXTERNAL_API_DISABLED`, and a service identifier.                                                                |
| `mock`     | Uses the fixed `trasolve-external-api-mock-v1` fixtures. A missing fixture fails closed with `EXTERNAL_API_MOCK_NOT_IMPLEMENTED`; it never falls back to a network provider. |

The controlled service identifiers are `google-places`, `google-routes`,
`google-oauth`, `gemini`, `openwebui`, `troute`, and `tcache`. Block logs contain
only the mode, service, operation, and error code. They do not contain request
bodies, keys, tokens, or user data.

`mock` is rejected when `NODE_ENV=production` unless
`TRASOLVE_EXTERNAL_API_MOCK_ALLOW_PRODUCTION=true` is also present. This override
is only for an explicitly isolated performance-test container. Normal deployment
configuration leaves the mode at `enabled` and the override at `false`.

## Frontend build control

`VITE_EXTERNAL_API_MODE=disabled` prevents the Google Maps JavaScript loader from
being invoked and skips Sentry initialization. A tperf frontend image must be
built with this value and without `VITE_GOOGLE_MAPS_API_KEY` or `VITE_SENTRY_DSN`.
An empty Maps key is defense in depth, not the mechanism that disables the
loader. An unknown frontend or backend mode fails during build/module startup or
backend startup, respectively.

The frontend's ordinary `fetch` and `EventSource` calls use relative Trasolve
API paths and remain available. Dynamic avatar/image URLs stored in user or share
data can still point to external origins; the call-control mode does not rewrite
user data. The tperf dataset should not contain such URLs, and browser-level
egress policy remains necessary when all browser requests must be isolated.

## Mock coverage

- Places autocomplete and details derive stable IDs and coordinates from the
  request and fixed seed.
- Routes returns a stable route while preserving request parsing and route
  service normalization.
- Google OAuth redirects only to the same-origin callback and then uses the
  normal authentication repository and session creation flow with a stable mock
  profile.
- Gemini and OpenWebUI return stable chat/model fixtures through the normal chat
  service.
- troute uses the normal gateway job repository and synchronization path with a
  stable completed remote job.
- tcache returns stable gateway health, job, result, cancel, and event-stream
  responses.

DB connections, local/debug authentication, trip CRUD, sharing, and Analytics are
not governed by this policy. Select a dedicated `DATABASE_URL` and persistence
mode independently.

## tperf deployment requirements

The tperf Docker and benchmark configuration is intentionally a follow-up task.
That environment must apply all of these controls together:

1. Set `TRASOLVE_EXTERNAL_API_MODE=disabled` (or the explicitly permitted
   production `mock` mode) in the backend.
2. Build the frontend with `VITE_EXTERNAL_API_MODE=disabled`.
3. Do not inject production Google, OAuth, Gemini, OpenWebUI, troute, tcache, or
   Sentry credentials/URLs into the test containers.
4. Apply container/network egress restrictions, allowing only required internal
   services such as the dedicated test database. Application policy alone is not
   a general network sandbox.
5. Treat any newly discovered provider path as a failure until it is explicitly
   classified and guarded.

The source inventory found external runtime calls only in the seven controlled
backend services plus the frontend Maps loader and Sentry SDK. Deployment and
localization maintenance scripts also call GitHub, health-check URLs, and Google
Sheets, but they do not run inside the Trasolve application process and are out
of the tperf application runtime scope.

The backend call inventory is: Places autocomplete/details; Routes
`computeRoutes`; OAuth authorization redirect, token exchange, and UserInfo;
Gemini content generation; OpenWebUI models/responses; and every troute/tcache
HTTP or event-stream operation. No Google Route Matrix (`computeRouteMatrix`)
call exists in the current source. The frontend inventory is the Maps JavaScript
script loader and Sentry initialization; all other application API calls are
same-origin Trasolve requests.
