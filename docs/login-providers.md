# Login providers

The landing and map login actions open a shared, keyboard-accessible provider
choice dialog. Google retains its existing Authorization Code + PKCE flow.
The Soongsil option navigates to the university's own SSO page; Trasolve does
not collect a university ID/password. Debug guest behavior remains opt-in
through the existing debug controls. Normal login actions always open the
provider choice dialog, including during Vite development.

The landing hero shows a sign-in action while signed out and a trip-planning
action while signed in. During session loading, the action remains disabled.
The browser remembers only the last successfully used provider (`google` or
`ssu`) in local storage and shows a recent-account speech bubble above that
provider when the dialog opens. Existing authenticated sessions seed this hint
if it is missing. Failed/cancelled login attempts and debug guest sessions do
not replace it; logout retains it. The hint never starts authentication or
selects a provider automatically, and account-linking dialogs omit it.
The speech bubble floats to the left of its provider button and points right;
it does not change the dialog height, button positions or provider spacing.
The login surface allows the bubble to extend beyond its edge. On narrow
viewports, the bubble moves above the whole dialog so it never covers either
provider button or clips against the side of the viewport.

## Soongsil protocol and provenance

Reference: [jonghokim27/ssutoday-v3](https://github.com/jonghokim27/ssutoday-v3)
at commit `6e666dbc8caf9a5825e66177c03adb7080164564`:

- `frontend/src/features/auth/config/sso.ts`
- `frontend/src/pages/auth/SsoCallbackPage.tsx`
- `ssutoday-common/ssutoday-adapter/src/main/kotlin/kr/ac/ssu/ssutoday/adapter/auth/UsaintAuthenticationAdapter.kt`

Protocol logic was reimplemented in TypeScript for Trasolve. Copyright 2026
Jongho Kim; the reference's Apache-2.0 license is retained in
`docs/licenses/SSUToday-Apache-2.0.txt`.

1. `GET /api/auth/ssu/start` creates a one-use, 10-minute transaction and an
   HttpOnly, SameSite=Lax cookie.
2. The browser visits `https://smartid.ssu.ac.kr/Symtra_sso/smln.asp` with
   `apiReturnUrl` set to the configured callback plus the random transaction
   state as a path segment. This avoids relying on the school preserving a
   query-string state while adding `sToken` and `sIdno`.
3. `/api/auth/ssu/callback/<state>` requires the same transaction cookie and
   state, then consumes the transaction before making provider requests.
4. The backend sends the ticket to
   `https://saint.ssu.ac.kr/webSSO/sso.jsp` and uses the returned school
   session cookies only to read `webSSUMain/main_student.jsp`.
5. The authenticated portal's student number must exactly match the callback
   number. The verified student number is the identity subject and the portal
   name is the display name. There is no department/enrollment restriction.
   This adapter expects the student portal's `학번` fields; staff portals are
   not inferred from a submitted ID.
6. Trasolve creates its normal opaque session and redirects immediately to a
   clean local URL. The existing one-use result endpoint also handles SSO
   results, tagged with `provider: ssu`.

The reference also contains an SSUtoday-specific `/sso/validateToken` API.
Trasolve does not use that service or its client credentials.

Requests have a 10-second timeout, 2MiB response limit, fixed HTTPS origins and
manual redirects. UTF-8 and Korean legacy encodings are supported. Raw tickets,
school cookies, passwords and portal HTML are not stored or logged by this
implementation. Configure any external access/error logging to omit callback
query parameters as well. Auth responses have `no-store` and `no-referrer`.
The existing external API policy covers `ssu-sso`; its two actual outbound
requests appear in the administrator's API usage counters without payloads.

## Hosting

SSO uses the incoming host routed by the trusted Caddy ingress, so preview
branches keep their transaction cookie and callback on their own origin.
The backend is private to the edge network; any other hosting must likewise
validate/allowlist public hosts at its trusted reverse proxy and preserve Host.
Without request context, configuration checks fall back to `TRASOLVE_PUBLIC_ORIGIN`
or the Google callback origin. For a fixed callback, set the backend-only
`SSU_SSO_REDIRECT_URI` to an absolute HTTPS URL ending exactly in
`/api/auth/ssu/callback`; local HTTP is allowed only on loopback hosts.
There is no client secret in the browser. An explicit SSO callback causes
login start to redirect to its origin before setting the transaction cookie.
Google's existing canonical-host alias redirect is retained independently.

## Users and linking

Existing `users`, `auth_identities` and session UUIDs are preserved. The SQL
schema already permits nullable identity emails and multiple identities per
user. The API, PostgreSQL queries and local repository now accept a user with
no email. No school email address is invented. Identity uniqueness remains
`(issuer, subject)`; the SSO issuer is `https://smartid.ssu.ac.kr`.
Migration `007_ssu_sso_usage.sql` only expands the usage-event service check;
it does not rewrite users or trips. The normal migration runner applies it.

A logged-in user can choose **Add** beside the login method in account settings
and authenticate with another provider. Linking records the user ID in the
server transaction, requires the same valid session at callback and after
provider verification, and refuses an identity owned by a different user.
Ordinary sign-in never auto-links by email. A first sign-in with an unlinked
SSO identity creates a separate account; users should add the provider from
their existing account when they want to retain its trips.
Production administrator access still requires the pre-existing explicit admin role and
verified Google identity; adding SSO does not grant administrative access.

## Verification

Repository type checking, production build and full code/localization lint pass for the
change. Manual requests against the real local backend also verified SSO
authorization redirects, rejection of unbound/malformed/replayed callbacks,
rejection of anonymous linking, and an unchanged signed-out session after
rejection. No university credentials or simulated provider replies were used.
Full school sign-in and authenticated account linking require a real
school account and are not represented as verified by these static checks.
The school's acceptance of Trasolve's callback host/state path must be checked
during that real sign-in. There are no fake provider responses or test-only
application branches.

# Terms and privacy onboarding

Both providers require current account-consent receipts before completing real
sign-in. New account creation waits until the consent form is submitted;
existing accounts without receipts are asked once. See
[account-consent.md](account-consent.md) for the API, storage, optional Google
profile handling, document versions and operator configuration.
