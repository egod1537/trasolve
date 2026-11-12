# Account terms and privacy onboarding

Google and Soongsil SSO authentication now stop before account creation when
the account has no receipt for the current terms/privacy version pair. The
callback places the identity in a bounded, one-use server-memory handoff and
redirects to `/auth/consent`. Its HttpOnly, SameSite cookie and pending identity
expire after ten minutes; an idle sweep also releases expired memory entries.
No profile, email or school identity is put in the URL or browser storage.

The form requires separate, initially unchecked age (14+), terms and account
collection/use confirmations. Google name/photo storage is optional and starts
unchecked. Declining it does not restrict the service. Those optional fields
are omitted from new account inserts and cleared from legacy Google profiles
when their first consent is recorded without that option. No marketing
consent or blanket consent to the privacy policy is inferred.

## Server enforcement and storage

- `GET /api/auth/consent`: current document versions, status, existing receipt,
  normalized return path, provider and public operator/contact metadata. It is
  available anonymously so documents are always readable.
- `POST /api/auth/consent`: strictly validated true confirmations and exact
  document versions. Requires a same-origin JSON request and either a live
  pending handoff or existing authenticated session. Client timestamps and
  unknown fields are rejected. Old document versions return 409.
- `POST /api/auth/consent/cancel`: discards the pending identity; for an existing
  account awaiting consent it also revokes the session. An already consented
  account is not logged out merely because a different signup was cancelled.
- Acceptance rotates the login session, and the server supplies a normalized,
  same-origin destination. A pending account-link operation remains bound to
  the initiating session.
- `CurrentUserResolver` admits a real account only with a current receipt,
  including pre-existing sessions. The frontend gate guides such users to the
  form but does not replace the API authorization check. The explicit local
  debug identity is exempt, without fabricating a consent receipt.

Migration `009_auth_consents.sql` adds immutable receipts keyed by internal user
ID and both document versions. New account, identity and receipt inserts share
one transaction. Existing users receive no backfilled consent. Local file
persistence reads old documents with an empty history and writes receipts
through its existing atomic mutation path. Neither implementation overwrites
the first receipt when a request is repeated. Account hard deletion cascades
the receipt; the receipt contains no IP address or user-agent fingerprint.

## Public documents and mobile layout

`/legal/terms` and `/legal/privacy` are public, linked from the login dialog,
landing footer, consent form and account settings. Account settings also show
the accepted versions and server timestamp. Text comes from the `legal`
localization tab and generated ko/ja/en/mn resources.

The form and documents reflow at 320px and above. On mobile, explanation rows
stack, confirmation targets are at least 44px high, actions stack with the
primary action first, safe-area insets are respected and the document scrolls
normally. The existing `?mobile=1` layout preview survives the OAuth handoff,
document links, cancellation and return to the original page.

## Operator information and operational follow-through

Set `TRASOLVE_LEGAL_OPERATOR_NAME` and `TRASOLVE_PRIVACY_CONTACT_EMAIL` to the
actual public operator and privacy contact in the deployment environment.
Compose templates forward both. No personal name or email address is invented.
Until configured, pages identify the Trasolve team and link to the existing
public repository inquiry channel, explicitly warning against posting private
information there.

The included documents describe the implemented collection paths, rather than
certifying the service's legal compliance. Before general public operation,
the operator must confirm the responsible contact, actual provider/processor
arrangements, overseas processing countries and retention periods against the
deployed Google/AI/payment configuration, and publish any additional legally
required disclosures or feature-specific consent. Account signup consent does
not authorize unrelated third-party disclosures or international transfers.

Privacy requests currently go to the operator; this change does not introduce
self-service account deletion. Handle authenticated access/correction/deletion
and consent-withdrawal requests through that channel, including optional Google
profile removal without closing the account. Complete deletion must include
owned/shared trips and any operator-managed copies, logs and backups, subject
to actual statutory retention requirements. Do not represent a soft delete
alone as erasure.

## Version changes

`LEGAL_VERSIONS` is the server/client source of truth. The `v20261112` text keys
are the document snapshot for the initial release. When legal content changes,
archive the old snapshot, add a new version and update public version routing
and `LEGAL_VERSIONS` together; never silently change a published snapshot under
the same version. An older frontend cannot submit acceptance for a newer
server document, even if it fetched the newer status response. An unknown
`?version=` shows an unavailable notice rather than substituting other text.

References for the operator's review:
[Personal Information Protection Act, current text](https://www.law.go.kr/LSW/lsInfoP.do?ancYnChk=0&chrClsCd=010202&efYd=20260911&lsiSeq=283839),
especially Articles 15, 16, 22, 22-2, 28-8 and 30. This implementation does not
replace review of the service's actual processing practices.

## Verification

Type checking, production build, lint (zero errors), localization audit and the
frontend dependency check pass. Thirty-nine manual domain/HTTP checks used the
real local repositories and consent handlers, including the running backend:
new-account deferral, optional profile inclusion/exclusion, legacy gating,
receipt immutability, session rotation, stale versions, malformed confirmations,
origin rejection, one-use handoffs, cancellation and mobile return paths.
External APIs were disabled; no provider responses were mocked. Live Google/SSO
sign-in and the PostgreSQL migration were not exercised in this environment.
The browser's policy rejected access to the local tab, so visual rendering on
desktop and mobile remains unverified. Responsive styles and forced-mobile
selectors were included in the production build.

The localization connector read back all 63 rows and verified translations,
wrapping and status validation before the canonical resource generator wrote
the four locale snapshots; it did not rewrite unrelated namespaces.
