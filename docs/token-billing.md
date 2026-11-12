# Token balances and payments

## User flow

- The trip picker shows the profile button only. An opened trip shows the
  signed-in user's stored token balance beside the profile.
- The plus button opens monthly subscriptions or one-time token packages.
- Route optimization uses icon buttons for transport and departure policy,
  displays only the current remaining number and gauge. Checkout errors belong
  to the plan dialog. A failed/pending summary does not disable Run; the server
  still enforces authentication and sufficient balance on every submission.
- AI chat does not display a cost; it updates the same wallet after each reply.
- Optimization shows a preflight quote based on the selected day and current
  server policy. Cached results show zero; insufficient balance uses this quote.
- Paid membership badges use a silver-blue Plus treatment and a champagne-gold
  Pro treatment on the map balance. Decreasing balances count down over 720ms and
  gauges ease to the new value; reduced-motion preferences disable both effects.
- Subscription cancellation opens a confirmation dialog with the period end date;
  confirmation schedules cancellation and retains the paid badge until expiry.
- The sample balance is removed. New wallets receive 2,000 tokens.

## Environments and URL debug mode

In local and preview frontend builds, `?debug=1` is propagated to billing,
chat, and optimization requests. It selects `DebugPaymentProvider` and a separate
`(user_id, debug)` wallet. The existing simulator offers success, failure, and
cancel controls in a separate confirmation dialog with the product, amount, and
token grant. No charge is confirmed until the user accepts. Closing or cancelling
the dialog cancels the pending order. Completion and failure use a result dialog,
never inline messages that resize the plan grid. The simulator does not load Toss
or call its API. Without the flag, billing
uses `TossPaymentProvider` and its sandbox/live wallet as before.

`TRASOLVE_DEBUG_PAYMENTS=true` is the local/Compose/preview default;
`false` disables simulation. A backend configured with live Toss keys always
rejects a debug payment request with `PAYMENT_DEBUG_DISABLED`, even if this setting
is true. Disabled requests never fall back to real checkout. Production frontend
builds continue to ignore the URL debug flag. Debug orders, credits, subscriptions,
and usage never change sandbox/live wallets. The renewal scanner processes debug
subscriptions only while simulation is enabled, using the same debug provider.

The flag also requests unlimited usage, governed independently by
`TRASOLVE_DEBUG_UNLIMITED_TOKENS=auto|true|false`: `auto` authorizes the isolated
debug wallet (or a debug guest session), `false` forces metering, and `true`
authorizes unlimited usage. The debug-only ∞ switch beside the map balance and in
the plan header toggles the request preference without changing providers or
wallets. The preference is saved locally and synchronized across tabs. An explicit
`X-Trasolve-Token-Debug: 0` overrides `?debug=1` for metering; `1` requests unlimited
usage. The summary's `unlimitedAvailable` controls whether the switch is enabled,
and `unlimited` is the authoritative state shown by the UI. Authorized requests skip reservation/settlement and return `unlimited: true`.
The legacy token-debug header alone requests unlimited usage without switching
payment providers; the URL marker selects the payment wallet consistently.

Matching `test_ck_...` / `test_sk_...` keys select the Toss `sandbox` wallet and
always open the Toss test checkout. Matching `live_ck_...` / `live_sk_...` keys
select the `live` wallet. Sandbox and live balances, orders, and usage are
isolated by `(user_id, mode)`. Without configured keys, free tokens remain usable
and checkout is unavailable.

## Toss setup

1. Supply `TOSS_PAYMENTS_CLIENT_KEY` and `TOSS_PAYMENTS_SECRET_KEY` for one-time
   payments. Use a matching `test_ck_...` / `test_sk_...` API individual-
   integration pair from the same general-payment MID, not widget `gck` keys or
   a Toss security key. Put direct-development values in the ignored
   `backend/.env.local`; put Compose values in the ignored root `.env`. Only the
   public client key reaches the browser.
2. Automatic billing uses separate `TOSS_BILLING_CLIENT_KEY` and
   `TOSS_BILLING_SECRET_KEY` values from its own MID. Leave both unset when only
   testing one-time top-ups; subscription checkout remains disabled. When both
   payment types are configured, all keys must use the same test/live mode.
3. Set `TRASOLVE_PUBLIC_ORIGIN` to the exact frontend origin: normally
   `http://127.0.0.1:5173` for `npm run dev` or `http://127.0.0.1:4173` for
   `compose.dev.yaml`. Hosted deployment derives it from `JJS_HOSTNAME`; set the
   Toss keys in the operator-owned `~/.config/jjs/deploy.env` so Compose passes
   them to the backend container. Checkout returns to the current page, keeping
   the trip and debug parameters. Callback keys are removed from browser history
   immediately after copying them for server confirmation.
4. For subscriptions, also set `TRASOLVE_PAYMENT_ENCRYPTION_KEY` to a base64
   encoded 32-byte random key. For example, generate it locally with
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`.
   Store the key securely and back it up. Do not change it while encrypted billing
   keys exist without a migration. Card details never enter Trasolve storage.
5. Configure Toss `PAYMENT_STATUS_CHANGED` and `CANCEL_STATUS_CHANGED` webhooks
   to `https://<your-host>/api/billing/webhook`. This endpoint re-queries Toss with
   the server key; webhook amounts and statuses are never trusted directly.
6. First verify a checkout with your own Toss test keys. Real billing additionally
   requires the relevant Toss merchant/billing contract. No live transaction is
   initiated by development or verification of this change.

Official integration references:

- https://docs.tosspayments.com/guides/v2/payment-window/integration
- https://docs.tosspayments.com/guides/v2/billing/integration
- https://docs.tosspayments.com/reference
- https://docs.tosspayments.com/guides/v2/webhook

## Catalog and token policy

The server owns amounts and token quantities. The browser sends a product ID,
never an arbitrary price or token credit.

| Product   | Default price | Tokens | Payment                                   |
| --------- | ------------: | -----: | ----------------------------------------- |
| Free      |         0 KRW |  2,000 | Welcome grant, then a free monthly period |
| Plus      |     4,900 KRW | 20,000 | Monthly automatic billing                 |
| Pro       |     9,900 KRW | 50,000 | Monthly automatic billing                 |
| tokens20k |     4,900 KRW | 20,000 | One-time payment                          |
| tokens50k |     9,900 KRW | 50,000 | One-time payment                          |

Prices are configurable through `TRASOLVE_PLUS_PRICE`, `TRASOLVE_PRO_PRICE`,
`TRASOLVE_TOPUP_20K_PRICE`, and `TRASOLVE_TOPUP_50K_PRICE`. Prices and quantities are
snapshotted on the order. Changing configuration does not change an existing
order or subscription. Free allowances are granted lazily at account access;
missed inactive months do not accumulate. Existing tokens carry over. `provided`
is cumulative tokens granted, net of refunds; `remaining` subtracts usage.

The server owns the policy in `backend/src/billing/tokenPricing.ts`.
`TRASOLVE_TOKEN_MULTIPLIER` multiplies both actions; action multipliers
`TRASOLVE_TOKEN_CHAT_MULTIPLIER` and `TRASOLVE_TOKEN_OPTIMIZE_MULTIPLIER`
are independent. All default to 1. Invalid numeric settings fail startup.

Optimization charges `ceil(base * globalMultiplier * optimizeMultiplier *
2^((n-referencePlaces)/doublingPlaces))`, with a minimum of 1 and a configurable
maximum of 10,000,000. `n` is the number of submitted locations (including both
endpoints), even when best-effort skips some places. Defaults: base 50
(`TRASOLVE_TOKEN_OPTIMIZE_COST`), reference 10
(`TRASOLVE_TOKEN_ROUTE_REFERENCE_PLACES`), doubling interval 10
(`TRASOLVE_TOKEN_ROUTE_DOUBLING_PLACES`), cap 10,000,000
(`TRASOLVE_TOKEN_ROUTE_MAX_COST`). At multipliers 1, 5/10/20/30/40 locations
cost 36/50/100/200/400. Backend validation determines n; client amounts are never
accepted. The billing summary publishes `routeTokenPolicy`; shared quote arithmetic
keeps the modal estimate and balance check aligned with backend charging.
Only accepted optimization submissions are charged: cancellation/no feasible result
after acceptance still costs tokens, while submission failure refunds them.
Reusing the browser's existing optimization result costs zero. Ordinary directions
and validation remain unmetered.

Chat sums all completed model invocations within the request, including follow-up
suggestions. For each model, `(uncachedInput * inputRate + cachedInput * cacheRate

- output * outputRate) / 1,000,000`gives USD. Apply global/chat multipliers, divide
by`TRASOLVE_TOKEN_USD_PER_TOKEN`(default 0.0001), then round up once, minimum 1.
Responses API usage is read for JSON and SSE; Gemini includes thought tokens in
output. Usage comes only from the server's provider response. Model token counts
and an`estimated` flag are retained in the usage record, never prompt contents.

`TRASOLVE_TOKEN_MODEL_RATES` is a JSON object keyed by **returned model ID**:
`{"my-model":{"input":1,"output":5,"cachedInput":0.1}}`.
Values are USD per million tokens. These example/default rates are reference rates,
not an assertion of any hosted model's actual price. Configure deployment-specific
rates, including aliases returned by a proxy. Unknown/local models use
`TRASOLVE_TOKEN_AI_INPUT_USD_PER_MILLION` (1),
`TRASOLVE_TOKEN_AI_OUTPUT_USD_PER_MILLION` (5), and
`TRASOLVE_TOKEN_AI_CACHED_INPUT_USD_PER_MILLION` (0.1).
If a proxy omits usage, estimate tokens from UTF-8 bytes / 4 (plus four input
tokens per message), without a cache discount. This estimate is explicitly marked
in storage and cannot reproduce hidden reasoning/tool tokens. Proxies that report
usage are required for exact model accounting. `TRASOLVE_TOKEN_CHAT_COST` is retired.

Chat reserves up to `TRASOLVE_TOKEN_CHAT_MAX_COST` (default 1,000), bounded by the
available balance. That reservation is the maximum charge for this request;
settlement refunds the difference. Costs above this budget are absorbed by the
service, rather than overdrawing a wallet or failing an already generated reply.
Simultaneous requests cannot spend the same reserved balance. Failed requests
release their reservation. Authorized unlimited requests bypass accounting.

The server reserves tokens atomically before invoking the provider. Failures
release the reservation. A request UUID blocks replay. Reservations left by a
crash are released after fifteen minutes on wallet refresh. The interval exceeds
the upstream request timeouts. Balances and costs are checked again on the server,
so stale UI balances cannot overdraw a wallet through concurrent requests.

Subscriptions renew through a one-minute backend scan. Calendar months clamp
to valid dates. Failed or uncertain renewals retain the same order/idempotency
key and retry after one day. A processing lease prevents parallel confirmation
or abandoning an in-flight order. Cancellation stops the next renewal and keeps
already granted tokens. One active subscription is allowed. Plus can upgrade to Pro immediately using
the difference order described below; other paid-plan changes remain blocked. Pending checkouts can be abandoned and
expire after thirty minutes.

Confirmed provider refunds revoke the corresponding tokens exactly once. A refund
after tokens were spent may produce a negative balance, blocking further usage
until it is covered. Partial refunds revoke tokens in proportion to the refunded
amount, rounded up. Repeated notifications only revoke the additional difference.

## Persistence and API

Migration `008_token_billing.sql` adds `trasolve.billing_accounts`. PostgreSQL
transactions use a row lock for the aggregate's wallet, orders, subscription,
usage reservations and ledger. Local development uses an atomic JSON document
with a process-local write queue, matching existing local authentication storage;
use PostgreSQL for multiple backend processes. Ledger/order history is retained
for reconciliation; high-volume installations should normalize/archive this
history before individual JSON aggregates grow too large.

Authenticated endpoints:

- `GET /api/billing/summary`
- `POST /api/billing/orders`, body `{ productId }`
- `POST /api/billing/confirm`, body `{ orderId, paymentKey, amount }` for a top-up,
  or `{ orderId, authKey, customerKey }` for the initial subscription
- `POST /api/billing/subscription/cancel`
- `POST /api/billing/orders/<id>/abort`

Append `?debug=1` in a local or preview build for the isolated debug checkout
and wallet. The token policy above determines whether that wallet is metered.
Mutation requests carry `X-Trasolve-Billing: 1`, JSON content type and a checked
Origin/Fetch-Site. Metered chat/optimization requests additionally require
`X-Trasolve-Request-Id`, a UUID. The existing frontend APIs set these automatically.
The webhook endpoint authenticates state through the provider lookup rather
than a user session.

`PaymentProvider` defines approval, lookup, cancellation, billing-key issuance
and deletion. The composition root registers implementations via
`createPaymentProviders()`. `BillingService` depends only on that contract and
`BillingRepository`. Browser checkout launchers implement `CheckoutProvider`.
Replacing a PG does not require editing token accounting.

## Plus to Pro upgrades

An active Plus subscriber can select Pro. The server computes a one-time difference
from the existing subscription's snapshotted price/tokens to the current Pro catalog.
Defaults: 5,000 KRW and 30,000 extra tokens. Existing tokens and the renewal date
are preserved; the next renewal uses Pro's full 9,900 KRW / 50,000-token snapshot.
This is a full token-package difference, not a day-prorated charge. A scheduled
cancellation is cleared only after a successful upgrade, as shown by the next
renewal date and recurring amount in the confirmation dialog.

Upgrade orders reuse the stored billing key. The browser shows the immediate
charge/token delta, next renewal date, and next monthly price before confirmation;
no new card authorization or charge happens just from selecting Pro. Initial Toss
subscriptions still use Toss's authorization flow. Checkout records expose no
billing key. Prices and token amounts always come from server snapshots.

A subscription/period identity and upgrade-order lock prevent parallel upgrade,
cancellation, or renewal from changing the charged subscription. Reopening Pro
resumes an existing pending upgrade with the same order/idempotency key. Unattempted
orders expire after 30 minutes. Uncertain attempted payments retain their order
and can be retried; renewal resolves the provider state first. Documented definitive
card rejections close the failed order and release its lock so a fresh attempt is
possible; duplicate-order and outage responses remain uncertain. A late request after
the old period ends may only look up an attempted payment, never start a new charge.
Full upgrade refunds within the same period restore Plus; partial refunds revoke
the corresponding extra tokens. Later-period paid subscriptions are not reverted.

In debug mode, selecting Free opens an immediate cancellation confirmation.
Confirmation ends membership immediately, clears pending unprocessed subscription
orders, preserves token balances, and changes the badge to Free. Real/sandbox
wallets reject `immediate: true`; ordinary cancellation still takes effect at the
period end. Active payment processing must finish first.
