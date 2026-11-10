# Trasolve administrator operations

The administrator subsystem adds PostgreSQL-backed access control, account operations, privacy-minimized metadata views, outbound API telemetry, and append-only audit history under the existing Trasolve backend. Access requires the existing session cookie, an active internal user with `role = 'admin'`, and a verified identity whose issuer is exactly `https://accounts.google.com`. Every `/api/admin/*` request re-reads those facts from PostgreSQL.

The administrator screens are implemented in `frontend/src/pages/admin`: summary dashboard, cursor-paginated user and Trip metadata tables, user detail and account actions, API usage with accessible chart data, service observations, and append-only audit history. The `admin` namespace is registered in the localization Sheet in Korean, Japanese, English and Mongolian. [localization-rows.tsv](./localization-rows.tsv) records the 144 registered rows, marked TRANSLATED rather than manually reviewed. Production snapshots were generated with the existing localization generator from verified live Sheet values retrieved through the connected Sheets API; no production translations were edited manually. The same synchronization also includes the already registered analytics namespace and map labels missing from the previous snapshots.

## Runtime configuration

Administrator APIs are enabled only when `TRASOLVE_PERSISTENCE_MODE=postgres`. Local-file mode returns `503 ADMIN_REQUIRES_POSTGRES` and never promotes the debug guest.

Set these backend-only values in the deployment environment:

- `DATABASE_URL`: PostgreSQL connection string used by the existing backend.
- `TRASOLVE_ADMIN_CSRF_SECRET`: at least 32 random bytes used to sign session-bound, two-hour CSRF tokens. Do not expose it through a `VITE_*` variable.
- `TRASOLVE_PUBLIC_ORIGIN`: exact browser origin, such as `https://trasolve.example.com`, used for administrator mutation Origin validation.
- Existing Google OAuth variables remain the only administrator login provider.

The session cookie stays `HttpOnly` and `SameSite=Lax`. Mutating administrator requests additionally require a matching Origin or Referer and the `X-Trasolve-CSRF` token returned by `GET /api/admin/me`.

The unauthenticated `/api/internal/troute/*` and `/api/internal/tcache/*` testbed gateways are available only outside production. Production returns 404 for those prefixes; normal `/api/troute/optimize` behavior is unchanged.

## Database rollout

Migrations are append-only:

- `004_admin_access.sql` adds `users.role` and `users.suspended_at`.
- `005_admin_audit.sql` creates append-only `admin_audit_events`.
- `006_external_api_calls.sql` creates privacy-minimized `external_api_call_events`.

Before `npm run db:migrate`, take a database snapshot or `pg_dump` that has been verified readable. Apply the application and migrations in the same maintenance window, then smoke-check OAuth, `/api/auth/me`, owner-only Trip CRUD, shared Trip reads, and the administrator endpoints. Do not edit an applied migration or its checksum. Rollback means restoring the pre-migration backup and deploying the previous application image; dropping columns or tables ad hoc is not the supported recovery path.

## First administrator bootstrap

Apply migrations 004 through 006 after the required backup. The operator must then complete real Google OAuth so the internal user and canonical Google identity exist. Obtain the internal UUID from controlled database access, not from an email-only lookup. The bootstrap CLI does not run migrations.

Inspect without writing:

```text
npm run admin:bootstrap -- --user-id <internal-uuid> --dry-run
```

After verifying the masked email, display name, UUID, issuer, and current role, grant the role:

```text
npm run admin:bootstrap -- --user-id <internal-uuid> --confirm
```

The command refuses deleted, suspended, unverified, non-Google, or unknown users and does not create accounts. Restrict command execution and `DATABASE_URL` access to approved operators. If every administrator loses access, the break-glass procedure is to restore database access, have the intended operator complete Google OAuth, run the dry-run, obtain the required operational approval, and run the confirmed grant. There is no public first-admin endpoint.

## API surface

All responses use JSON and `Cache-Control: no-store`.

- `GET /api/admin/me`: verified administrator identity and a session-bound CSRF token.
- `GET /api/admin/summary`: non-deleted users, active users, distinct seven-day logins, and non-deleted Trips.
- `GET /api/admin/users` and `GET /api/admin/users/:userId`: cursor-paginated account metadata and masked identity summaries.
- `POST /api/admin/users/:userId/suspend`, `/restore`, and `/revoke-sessions`: transactional state/session changes with one append-only audit event for each effective action.
- `GET /api/admin/trips` and `GET /api/admin/trips/:tripId/metadata`: Trip metadata only; no document, share token, notes, coordinates, or routes.
- `GET /api/admin/api-usage/summary`: database-side aggregate of measured backend outbound attempts.
- `GET /api/admin/operations/summary`: trailing 24-hour service observations and safe troute mirror counts without active provider probes. The response marks tcache job mirrors unavailable because Trasolve does not persist a local tcache mirror.
- `GET /api/admin/audit`: cursor-paginated privileged action history.

Anonymous PostgreSQL requests return `401 ADMIN_AUTH_REQUIRED`; authenticated but ineligible accounts return `403 ADMIN_FORBIDDEN`; authorization database failures return `503 ADMIN_UNAVAILABLE`. Local persistence returns `503 ADMIN_REQUIRES_POSTGRES` before disclosing account state.

## Account suspension and sessions

Suspension and deletion are separate. Suspending an account sets `suspended_at`, revokes every unexpired session, and writes the audit event in one database transaction. Session resolution joins the active user row, so existing normal and administrator sessions stop working immediately. Google OAuth may refresh identity metadata, but it cannot create a session for a suspended user. Restore is idempotent and permits a later login; it does not resurrect a previous session.

Administrators cannot suspend themselves or revoke their current account's sessions through the API. Role mutation is deliberately absent from the browser API. The bootstrap CLI only grants, so it cannot remove the last administrator.

## Data definitions

- Total users: `users.deleted_at IS NULL`.
- Active users: non-deleted users with `suspended_at IS NULL`.
- Recent login users: distinct identity `user_id` values with `last_login_at` in the preceding seven days.
- Total Trips: `trips.deleted_at IS NULL`.
- Actual outbound calls: events with `success`, `http_error`, or `network_error`; each retry attempt is a separate event.
- Failed calls: `http_error` plus `network_error`.
- Blocked and mock calls: recorded with `provider_request_count = 0` and excluded from actual calls and latency.
- Latency: monotonic elapsed time around the outbound `fetch`; aggregate average and P95 are computed in PostgreSQL.
- Time storage: UTC timestamps. Administrator reporting declares `Asia/Seoul` for graph labels and reporting context.

This telemetry covers backend calls to Google Places, Google Routes, Gemini, OpenWebUI, troute, tcache, and Google OAuth. Browser Google Maps JavaScript SDK traffic and any provider calls made internally by tcache are outside its coverage. The dashboard does not estimate cost or claim provider billing totals. Existing UX analytics remain a separate domain.

## Privacy, retention, and operational review

Outbound telemetry never stores request bodies, response bodies, URLs, query strings, headers, keys, OAuth tokens, email, place names, coordinates, Place IDs, Trip content, or AI prompts. User attribution is the server-resolved internal UUID or null. Audit metadata is restricted to scalar reason/status fields and session counts.

The default retention target for external API telemetry is 90 days. No unattended cleanup job is installed. A cleanup command or scheduler requires a separately reviewed operational change covering backup, deletion approval, observability, and rollback. Audit retention and backup access must follow the production privacy policy; application APIs provide no audit update or delete operation.

## UI source and dependencies

The header, main container and card primitives in `AdminPrimitives.tsx` are adapted from `satnaing/shadcn-admin` at revision `e16c87f213a5ba5e45964e9b67c792105ec74d26`, specifically `src/components/layout/header.tsx`, `src/components/layout/main.tsx`, and `src/components/ui/card.tsx`. The sidebar, account footer, summary cards and table layout follow the same reference. Tailwind styling is replaced by scoped CSS using Trasolve theme tokens, and the existing Blueprint icons are reused. No dependency was added. Clerk, TanStack Router, sample users and upstream business data are not included. The MIT copyright notice is preserved at [SHADCN-ADMIN-MIT.txt](../licenses/SHADCN-ADMIN-MIT.txt).

## Screen behavior

- Each section has independent loading, empty, failure and refresh states. Superseded asynchronous responses are ignored. No sample or fallback API data is displayed.
- User and Trip search/filter values are GET parameters, preserved on reload. Lists use backend cursor pagination; totals are not treated as a cursor page count.
- User detail opens in a keyboard-accessible dialog and links to that user's Trip metadata and API usage. Suspension, restoration and session revocation require an explicit confirmation. A fresh CSRF token is obtained before mutation, and the current actor is checked against the original session. Self-actions remain disabled in both the UI and API.
- API date filters use inclusive calendar dates in Asia/Seoul, converted to an exclusive end timestamp, with at most 90 days. Queries of two days or less use hourly buckets; longer ranges use daily buckets. The service table separates actual, blocked and mock calls. Charts include a text summary and an expandable data table. Per-user results are the top 20 identified users; anonymous calls remain in aggregate totals.
- Service configuration is not presented as a live health check. Job mirror counts cover at most 1,000 recent troute jobs and are not described as a trailing-24-hour total. Unsupported tcache job mirrors display unavailable values, not zero jobs.
- The sidebar becomes a keyboard-accessible drawer on mobile. Layout styles are scoped to admin elements and use the existing light/dark theme. The existing development-only guest administrator access is retained. Production authorization, OAuth, database, map, routing provider and public landing behavior are unchanged.

## Manual release verification

Verify with a real PostgreSQL administrator session:

1. Visit all six admin routes, including a signed-out and a non-admin account, and check loading, empty, refresh and failure states.
2. Search and filter user/Trip tables, move forward and backward through cursors, open two different details in succession, and inspect user-scoped Trip and API links.
3. Cancel and confirm an account action on a designated development account. Verify its state, revoked sessions and corresponding audit event. Current-account actions must remain unavailable.
4. Check API filters for a single day, a multi-day range, invalid/reversed ranges and the 90-day boundary. Verify totals, zero buckets, top users, table/chart labels and Korea time.
5. Confirm unconfigured services and unavailable tcache mirrors are distinguishable from observed failures and zero calls.
6. Check desktop/mobile layouts, keyboard navigation, drawer Escape/Tab behavior, dialog focus restoration and dark mode.

### Verification performed for this change

- Full workspace typecheck, ESLint/Oxlint, localization lint and production build passed.
- Browser verification covered all six routes against the real development backend, navigation, filter layout, and a reversed API date range rejected before submission.
- This workspace has local-file persistence and no PostgreSQL connection. The existing development guest administrator can enter the shell, while data endpoints correctly return `ADMIN_REQUIRES_POSTGRES`; the UI displays a localized explanation. Successful database reads, cursor results and account mutations were not exercised here and require the PostgreSQL verification above. No mock responses or test-only application code were introduced.
- The independent frontend architecture check still reports three existing cross-slice issues in preferences/auth/map-workspace; none involve the administrator pages.
