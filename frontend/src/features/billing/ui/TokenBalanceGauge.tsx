import { getLanguage, useL } from '@/shared/i18n';
import { Progress } from '@/shared/ui/Progress';

export function TokenBalanceGauge({
  remaining,
  provided,
}: {
  remaining?: number;
  provided: number;
}) {
  const L = useL();
  const number = new Intl.NumberFormat(getLanguage());
  const label =
    remaining === undefined
      ? L('auth:tokenPlans.remaining')
      : L('auth:tokenPlans.currentBalance', {
          balance: number.format(remaining),
        });
  return (
    <div className="token-balance-gauge" title={label}>
      {remaining !== undefined && <strong>{number.format(remaining)}</strong>}
      <Progress
        className="map-token-balance-progress"
        label={L('auth:tokenPlans.remaining')}
        value={remaining}
        max={provided}
        aria-valuetext={label}
      />
    </div>
  );
}
