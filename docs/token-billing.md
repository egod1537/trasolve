# Token balances and payments

## User flow

- The trip picker shows the profile button only. An opened trip shows the
  signed-in user's stored token balance beside the profile.
- The plus button opens monthly subscriptions or one-time token packages.
- Route optimization uses icon buttons for transport and departure policy,
  displays only the current remaining number and gauge. Checkout errors belong
  to the plan dialog. A failed/pending summary does not disable Run; the server
  still enforces authentication and sufficient balance on every submission.
- AI chat displays its cost and updates the same wallet after each reply.
- The sample balance is removed. New wallets receive 2,000 tokens.

## Environments and URL debug mode

Billing always uses `TossPaymentProvider`; `?debug=1` does not change the
payment provider, wallet, checkout, or token metering mode. The URL flag remains
available to unrelated developer features only. `TRASOLVE_DEBUG_PAYMENTS` stays
`false` in local, Compose, and hosted configuration so the self-contained
payment simulator cannot be selected accidentally.

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

`TRASOLVE_TOKEN_CHAT_COST` defaults to 10 tokens per successfully generated reply.
`TRASOLVE_TOKEN_OPTIMIZE_COST` defaults to 50 tokens per accepted optimization
submission. An optimization accepted by the solver is charged even if it is
later cancelled or has no feasible result; rejection before acceptance releases
the reservation. Reusing the browser's existing optimization result costs zero.

The server reserves tokens atomically before invoking the provider. Failures
release the reservation. A request UUID blocks replay. Reservations left by a
crash are released after fifteen minutes on wallet refresh. The interval exceeds
the upstream request timeouts. Balances and costs are checked again on the server,
so stale UI balances cannot overdraw a wallet through concurrent requests.

Subscriptions renew through a one-minute backend scan. Calendar months clamp
to valid dates. Failed or uncertain renewals retain the same order/idempotency
key and retry after one day. A processing lease prevents parallel confirmation
or abandoning an in-flight order. Cancellation stops the next renewal and keeps
already granted tokens. One active subscription is allowed; plan switching waits
until the previous subscription ends. Pending checkouts can be abandoned and
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

Append `?debug=1` for debug mode. The debug confirm body is
`{ orderId, outcome: "success" | "failure" | "cancel" }`.
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
