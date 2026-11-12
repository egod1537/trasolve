import { quoteRouteTokens } from '@trasolve/shared';
import { useBilling } from '../model/billingContext';
import { getLanguage, NL, useL } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { TokenChargeInfo } from './TokenChargeInfo';
import '@/features/billing/ui/token-plans.css';

export function TokenCostSummary({
  placeCount,
  cached = false,
}: {
  placeCount: number;
  cached?: boolean;
}) {
  const L = useL();
  const billing = useBilling();
  if (!billing.authenticated) {
    return (
      <div className="token-cost-inline">
        <Button size="sm" onClick={billing.login}>
          {L('common:landing.navigation.signIn')}
        </Button>
      </div>
    );
  }
  if (!billing.summary) {
    return (
      <div className="token-cost-inline" role="status">
        <TokenChargeInfo
          label={L('auth:tokenPlans.remaining')}
          message={billing.error ?? L('common:routes.loadingLabel.pageLoading')}
        />
        {billing.error && (
          <Button size="sm" onClick={() => void billing.refresh()}>
            {L('common:action.retry')}
          </Button>
        )}
      </div>
    );
  }
  const cost =
    billing.summary.unlimited || cached || placeCount < 2
      ? 0
      : billing.summary.routeTokenPolicy
        ? quoteRouteTokens(placeCount, billing.summary.routeTokenPolicy)
        : billing.summary.costs.optimize;
  const remaining = billing.summary.unlimited
    ? Infinity
    : billing.summary.wallet.remaining;
  const number = new Intl.NumberFormat(getLanguage());
  const insufficient = remaining < cost;
  return (
    <div className="token-cost-inline" data-insufficient={insufficient}>
      <strong
        aria-label={L('auth:billing.usageCost', { cost: number.format(cost) })}
      >
        {NL('−')}
        {number.format(cost)}
      </strong>
      <TokenChargeInfo
        label={L('auth:billing.usageCost', { cost: number.format(cost) })}
        message={
          cached
            ? L('auth:billing.cachedFree')
            : L('auth:billing.optimizationChargeNotice')
        }
        warning={insufficient ? L('auth:billing.insufficient') : undefined}
      />
    </div>
  );
}
