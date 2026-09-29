# Analytics session ID policy

Analytics uses one opaque session ID per browser tab to reconstruct a user's flow.
The frontend owns only session correlation; authenticated user identity is resolved
independently by the backend.

## Creation and storage

- `getAnalyticsSessionId()` is lazy. Importing the analytics client does not create
  a session; the first tracked event does.
- A missing session ID is generated with `crypto.randomUUID()`.
- The ID is stored under `trasolve.analytics.session_id` in `sessionStorage`.
- An in-memory copy avoids repeated storage reads during the current page lifecycle.
- The value is opaque. Callers must not parse it or attach product meaning to it.

If browser privacy settings make `sessionStorage` unavailable, analytics falls back
to an in-memory UUID. Events remain correlated for the current page lifecycle, while
reload persistence is unavailable in that restricted environment. This degradation
must never affect the user action that triggered analytics.

## Lifecycle

| User action                  | Session ID                                          |
| ---------------------------- | --------------------------------------------------- |
| Navigate within the same tab | Preserved                                           |
| Reload the page              | Preserved through `sessionStorage`                  |
| Log in or log out            | Preserved; auth state is not a session boundary     |
| Change language or theme     | Preserved                                           |
| Close the tab                | Ends when the tab's `sessionStorage` is discarded   |
| Open the app in a new tab    | New tab-scoped `sessionStorage`, therefore a new ID |

Do not move the ID to `localStorage`, a cookie, a URL, or authenticated user state.
Those mechanisms would either merge independent tabs, extend the lifetime beyond the
tab, or incorrectly couple analytics correlation to identity.

## Security boundary

The session ID is not an authentication credential, proof of identity, CSRF token,
or authorization input. The backend must never grant access based on it. The client
does not send `userId`; the backend derives `userId` from the authenticated request
when it persists an event.

Regenerating the analytics session must not sign a user in or out, and an auth change
must not regenerate the analytics session. Logging and diagnostics must treat the ID
as correlation data rather than a secret or user identifier.
