import { useLayoutMaxWidth } from '@/shared/hooks/useLayoutMaxWidth';
import { PlanBadge } from './PlanBadge';
import { useAnimatedTokenBalance } from '../model/useAnimatedTokenBalance';
import { DebugTokenToggle } from './DebugTokenToggle';
import { getLanguage, NL, useL } from '@/shared/i18n';
import { IconButton } from '@/shared/ui/IconButton';
import { PlusIcon } from '@/shared/ui/icons';
import { Progress } from '@/shared/ui/Progress';
import type { PaymentMode, TokenWallet } from '@trasolve/shared';
import '@/features/billing/ui/token-plans.css';

type Props = {
  remaining: number;
  allowance: number;
  open: boolean;
  dialogId: string;
  onOpen: () => void;
  mode: PaymentMode;
  plan: TokenWallet['plan'];
  unlimited?: boolean;
};

export function TokenBalanceControl({
  remaining,
  allowance,
  open,
  dialogId,
  onOpen,
  mode,
  plan,
  unlimited = false,
}: Props) {
  const L = useL();
  const compact = useLayoutMaxWidth();
  const displayed = useAnimatedTokenBalance(unlimited ? undefined : remaining);
  const number = new Intl.NumberFormat(getLanguage());

  return (
    <div
      className={`map-token-balance${compact ? ' is-compact' : ''}`}
      role="group"
      aria-label={L('auth:tokenPlans.remaining')}
      data-plan={plan}
      title={
        mode === 'debug'
          ? L('auth:billing.debugNotice')
          : mode === 'sandbox'
            ? L('auth:billing.sandboxNotice')
            : L('auth:tokenPlans.remaining')
      }
    >
      <div className="map-token-balance-copy">
        <span className="map-token-balance-label">
          {!compact && L('auth:tokenPlans.remaining')}
          <PlanBadge plan={plan} showFree={compact} />
          {mode === 'debug' ? (
            <DebugTokenToggle compact />
          ) : mode === 'sandbox' ? (
            <span className="map-token-preview-label">
              {L('auth:billing.testMode')}
            </span>
          ) : null}
        </span>
        <span className="map-token-balance-value">
          <strong>
            {unlimited ? NL('∞') : number.format(displayed ?? remaining)}
          </strong>
          {!compact && !unlimited && (
            <span>
              {L('auth:tokenPlans.allowanceSuffix', {
                allowance: number.format(allowance),
              })}
            </span>
          )}
        </span>
        <Progress
          className="map-token-balance-progress"
          label={L('auth:tokenPlans.remaining')}
          value={unlimited ? 1 : (displayed ?? remaining)}
          max={unlimited ? 1 : allowance}
          aria-valuetext={unlimited ? L('auth:billing.debugMode') : undefined}
        />
      </div>
      <IconButton
        className="map-token-add token-shimmer"
        aria-label={L('auth:tokenPlans.open')}
        title={L('auth:tokenPlans.open')}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        variant="ghost"
        icon={<PlusIcon />}
        onClick={onOpen}
      />
    </div>
  );
}
