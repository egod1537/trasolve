import type { TokenAction } from '@trasolve/shared';
import { useBilling } from '../model/billingContext';
import { getLanguage, useL } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import '@/features/billing/ui/token-plans.css';

export function TokenCostSummary({
  action,
  cached = false,
}: {
  action: TokenAction;
  cached?: boolean;
}) {
  const L = useL();
  const billing = useBilling();
  if (!billing.authenticated) {
    return (
      <div className="token-cost-summary">
        <span>{L('auth:billing.signInRequired')}</span>
        <Button size="sm" onClick={billing.login}>
          {L('common:landing.navigation.signIn')}
        </Button>
      </div>
    );
  }
  if (!billing.summary) {
    return (
      <div className="token-cost-summary">
        <span role="status">
          {billing.error ?? L('common:routes.loadingLabel.pageLoading')}
        </span>
        {billing.error && (
          <Button size="sm" onClick={() => void billing.refresh()}>
            {L('common:action.retry')}
          </Button>
        )}
      </div>
    );
  }
  if (billing.summary.unlimited) {
    return null;
  }
  const cost = cached ? 0 : billing.summary.costs[action];
  const remaining = billing.summary.wallet.remaining;
  const number = new Intl.NumberFormat(getLanguage());
  const insufficient = remaining < cost;
  return (
    <div className="token-cost-summary" data-insufficient={insufficient}>
      <div className="token-cost-values">
        <strong>
          {L('auth:billing.usageCost', { cost: number.format(cost) })}
        </strong>
        <span>
          {L('auth:billing.remainingBalance', {
            balance: number.format(remaining),
          })}
        </span>
      </div>
      {insufficient ? (
        <div className="token-cost-warning">
          <span>{L('auth:billing.insufficient')}</span>
          <Button size="sm" onClick={billing.openPlans}>
            {L('auth:billing.topup')}
          </Button>
        </div>
      ) : (
        <p>
          {cached
            ? L('auth:billing.cachedFree')
            : action === 'optimize'
              ? L('auth:billing.optimizationChargeNotice')
              : L('auth:billing.chatChargeNotice')}
        </p>
      )}
    </div>
  );
}
