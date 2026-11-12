import { useBilling } from '../model/billingContext';
import { TokenBalanceGauge } from './TokenBalanceGauge';
import { PlanBadge } from './PlanBadge';
import { useL } from '@/shared/i18n';
import { IconButton } from '@/shared/ui/IconButton';
import { PlusIcon } from '@/shared/ui/icons';
import './token-remaining-gauge.css';

export function TokenRemainingGauge() {
  const L = useL();
  const { summary, plansOpen, dialogId, openPlans } = useBilling();
  return (
    <div className="token-remaining-gauge" data-plan={summary?.wallet.plan}>
      {summary && <PlanBadge plan={summary.wallet.plan} showFree />}
      <TokenBalanceGauge
        remaining={summary?.wallet.remaining}
        provided={summary?.wallet.provided ?? 1}
        unlimited={summary?.unlimited}
      />
      <IconButton
        className="token-remaining-topup"
        variant="ghost"
        aria-label={L('auth:tokenPlans.open')}
        title={L('auth:tokenPlans.open')}
        aria-haspopup="dialog"
        aria-expanded={plansOpen}
        aria-controls={plansOpen ? dialogId : undefined}
        icon={<PlusIcon />}
        onClick={openPlans}
      />
    </div>
  );
}
