import { useAnimatedTokenBalance } from '../model/useAnimatedTokenBalance';
import { getLanguage, NL, useL } from '@/shared/i18n';
import { Progress } from '@/shared/ui/Progress';

export function TokenBalanceGauge({
  remaining,
  provided,
  unlimited = false,
}: {
  remaining?: number;
  provided: number;
  unlimited?: boolean;
}) {
  const L = useL();
  const displayed = useAnimatedTokenBalance(unlimited ? undefined : remaining);
  const number = new Intl.NumberFormat(getLanguage());
  const label = unlimited
    ? L('auth:billing.debugMode')
    : remaining === undefined
      ? L('auth:tokenPlans.remaining')
      : L('auth:tokenPlans.currentBalance', {
          balance: number.format(remaining),
        });
  const display = unlimited
    ? NL('∞')
    : remaining === undefined
      ? null
      : number.format(displayed ?? remaining);
  return (
    <div className="token-balance-gauge" title={label}>
      {display !== null && <strong>{display}</strong>}
      <Progress
        className="map-token-balance-progress"
        label={L('auth:tokenPlans.remaining')}
        value={unlimited ? 1 : (displayed ?? remaining)}
        max={unlimited ? 1 : provided}
        aria-valuetext={label}
      />
    </div>
  );
}
