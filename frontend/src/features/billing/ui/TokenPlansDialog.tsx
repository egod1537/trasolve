import { useId, useState } from 'react';
import type { PaymentProductId } from '@trasolve/shared';
import { useBilling } from '../model/billingContext';
import { TokenBalanceGauge } from './TokenBalanceGauge';
import { getLanguage, NL, useL } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { IconButton } from '@/shared/ui/IconButton';
import { CloseIcon } from '@/shared/ui/icons';
import '@/features/billing/ui/token-plans.css';

export function TokenPlansDialog() {
  const L = useL();
  const billing = useBilling();
  const titleId = useId(),
    descriptionId = useId();
  const [tab, setTab] = useState<'subscription' | 'topup'>('subscription');
  const number = new Intl.NumberFormat(getLanguage());
  const money = new Intl.NumberFormat(getLanguage(), {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  });
  const summary = billing.summary;
  const checkoutAvailable =
    tab === 'subscription'
      ? summary?.subscriptionAvailable
      : summary?.topupAvailable;
  const names = { plus: NL('Plus'), pro: NL('Pro'), free: NL('Free') };
  const features = {
    free: [
      L('auth:tokenPlans.feature.aiItinerary'),
      L('auth:tokenPlans.feature.editAndSave'),
      L('auth:tokenPlans.feature.placeSuggestions'),
    ],
    plus: [
      L('auth:tokenPlans.feature.freeIncluded'),
      L('auth:tokenPlans.feature.moreItineraries'),
      L('auth:tokenPlans.feature.personalizedSuggestions'),
    ],
    pro: [
      L('auth:tokenPlans.feature.plusIncluded'),
      L('auth:tokenPlans.feature.moreUsage'),
      L('auth:tokenPlans.feature.complexItineraries'),
    ],
  };
  const cards = summary
    ? [
        ...(tab === 'subscription'
          ? [{ id: 'free' as const, amount: 0, tokens: 2000 }]
          : []),
        ...summary.products.filter((p) => p.kind === tab),
      ]
    : [];
  return (
    <Dialog
      id={billing.dialogId}
      className="token-plans-dialog"
      labelledBy={titleId}
      describedBy={descriptionId}
      busy={billing.busy}
      closeOnEscape={!billing.busy}
      closeOnBackdrop={!billing.busy}
      onClose={billing.closePlans}
    >
      <header className="token-plans-header">
        <div className="token-plans-heading">
          <div>
            <div className="token-plans-title-row">
              <h2 id={titleId}>{L('auth:tokenPlans.title')}</h2>
              {summary && summary.mode !== 'live' && (
                <span className="token-plans-mode-badge">
                  {summary.mode === 'debug'
                    ? L('auth:billing.debugMode')
                    : L('auth:billing.testMode')}
                </span>
              )}
            </div>
            <p id={descriptionId}>{L('auth:tokenPlans.description')}</p>
          </div>
        </div>
        {summary && (
          <div className="token-plans-header-balance">
            <TokenBalanceGauge
              remaining={summary.wallet.remaining}
              provided={summary.wallet.provided}
              unlimited={summary.unlimited}
            />
          </div>
        )}
        <IconButton
          className="token-plans-close"
          aria-label={L('common:action.close')}
          variant="ghost"
          icon={<CloseIcon />}
          disabled={billing.busy}
          onClick={billing.closePlans}
        />
      </header>
      <div
        className="billing-tabs"
        role="group"
        aria-label={L('auth:billing.purchaseType')}
      >
        <Button
          aria-pressed={tab === 'subscription'}
          variant={tab === 'subscription' ? 'primary' : 'ghost'}
          disabled={billing.busy || Boolean(billing.debugCheckout)}
          onClick={() => setTab('subscription')}
        >
          {L('auth:billing.monthlySubscription')}
        </Button>
        <Button
          aria-pressed={tab === 'topup'}
          variant={tab === 'topup' ? 'primary' : 'ghost'}
          disabled={billing.busy || Boolean(billing.debugCheckout)}
          onClick={() => setTab('topup')}
        >
          {L('auth:billing.topup')}
        </Button>
      </div>
      {billing.loading && !summary && (
        <p role="status">{L('common:routes.loadingLabel.pageLoading')}</p>
      )}
      {!billing.authenticated && (
        <Button variant="primary" onClick={billing.login}>
          {L('common:landing.navigation.signIn')}
        </Button>
      )}
      {billing.error && (
        <div className="billing-error" role="alert">
          <p>{billing.error}</p>
          <Button onClick={() => void billing.refresh()}>
            {L('common:action.retry')}
          </Button>
        </div>
      )}
      {billing.message && (
        <p className="billing-message" role="status">
          {billing.message}
        </p>
      )}
      {billing.debugCheckout && (
        <section
          className="billing-debug-checkout"
          aria-label={L('auth:billing.debugCheckout')}
        >
          <h3>{L('auth:billing.debugCheckout')}</h3>
          <p>
            {L('auth:billing.debugAmount', {
              amount: money.format(billing.debugCheckout.product.amount),
              tokens: number.format(billing.debugCheckout.product.tokens),
            })}
          </p>
          <div className="billing-debug-actions">
            <Button
              variant="primary"
              disabled={billing.busy}
              onClick={() => void billing.finishDebug('success')}
            >
              {L('auth:billing.simulateSuccess')}
            </Button>
            <Button
              variant="danger"
              disabled={billing.busy}
              onClick={() => void billing.finishDebug('failure')}
            >
              {L('auth:billing.simulateFailure')}
            </Button>
            <Button
              disabled={billing.busy}
              onClick={() => void billing.finishDebug('cancel')}
            >
              {L('common:action.cancel')}
            </Button>
          </div>
        </section>
      )}
      <div className="token-plans-grid" data-kind={tab}>
        {cards.map((plan) => {
          const planName =
            plan.id === 'free' || plan.id === 'plus' || plan.id === 'pro'
              ? names[plan.id]
              : L('auth:billing.tokenPack', {
                  tokens: number.format(plan.tokens),
                });
          const current =
            tab === 'subscription' && plan.id === summary?.wallet.plan;
          const paidSubscriptionExists = summary?.wallet.renewsAt !== null;
          const featureGroup =
            plan.id === 'free' || plan.id === 'plus' || plan.id === 'pro'
              ? features[plan.id]
              : [
                  L('auth:billing.topupFeature'),
                  L('auth:tokenPlans.usageDescription'),
                ];
          return (
            <article
              key={plan.id}
              className={`token-plan-card${plan.id === 'plus' ? ' token-shimmer' : ''}`}
              data-recommended={plan.id === 'plus'}
            >
              <div className="token-plan-name-row">
                <h3>{planName}</h3>
                {plan.id === 'plus' && (
                  <span className="token-plan-recommended">
                    {L('auth:tokenPlans.recommended')}
                  </span>
                )}
              </div>
              <p className="token-plan-subtitle">
                {plan.id === 'free'
                  ? L('auth:tokenPlans.freeSubtitle')
                  : plan.id === 'plus'
                    ? L('auth:tokenPlans.plusSubtitle')
                    : plan.id === 'pro'
                      ? L('auth:tokenPlans.proSubtitle')
                      : L('auth:billing.topupDescription')}
              </p>
              <div className="token-plan-price">
                <strong>
                  {plan.amount === 0
                    ? L('auth:tokenPlans.freePrice')
                    : money.format(plan.amount)}
                </strong>
                {plan.amount > 0 && (
                  <span>
                    {tab === 'subscription'
                      ? L('auth:tokenPlans.perMonth')
                      : L('auth:billing.oneTime')}
                  </span>
                )}
              </div>
              <div className="token-plan-allowance">
                {tab === 'subscription'
                  ? L('auth:tokenPlans.monthlyAllowance', {
                      allowance: number.format(plan.tokens),
                    })
                  : L('auth:billing.tokenPack', {
                      tokens: number.format(plan.tokens),
                    })}
              </div>
              <ul className="token-plan-features">
                {featureGroup.map((feature) => (
                  <li key={feature}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m5 12 4 4L19 6" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                className="token-plan-select"
                variant={plan.id === 'plus' ? 'primary' : 'secondary'}
                disabled={
                  current ||
                  plan.id === 'free' ||
                  billing.busy ||
                  Boolean(billing.debugCheckout) ||
                  !checkoutAvailable ||
                  (tab === 'subscription' && paidSubscriptionExists)
                }
                onClick={() =>
                  void billing.purchase(plan.id as PaymentProductId)
                }
              >
                {current
                  ? L('auth:tokenPlans.currentPlan')
                  : L('auth:tokenPlans.selectPlan', { plan: planName })}
              </Button>
            </article>
          );
        })}
      </div>
      <footer className="token-plans-footer">
        <p>{L('auth:tokenPlans.usageDescription')}</p>
        {tab === 'subscription' && <p>{L('auth:billing.subscriptionTerms')}</p>}
        {summary?.wallet.renewsAt && (
          <div className="billing-subscription-status">
            <p>
              {summary.wallet.cancelAtPeriodEnd
                ? L('auth:billing.endsAt', {
                    date: new Intl.DateTimeFormat(getLanguage()).format(
                      new Date(summary.wallet.renewsAt),
                    ),
                  })
                : L('auth:billing.renewsAt', {
                    date: new Intl.DateTimeFormat(getLanguage()).format(
                      new Date(summary.wallet.renewsAt),
                    ),
                  })}
            </p>
            <Button
              disabled={billing.busy || summary.wallet.cancelAtPeriodEnd}
              onClick={() => void billing.cancelSubscription()}
            >
              {L('auth:billing.cancelSubscription')}
            </Button>
          </div>
        )}
        {summary && !checkoutAvailable && (
          <p role="status">{L('auth:billing.notConfigured')}</p>
        )}
      </footer>
    </Dialog>
  );
}
