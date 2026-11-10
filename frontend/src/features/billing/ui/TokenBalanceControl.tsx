import { getLanguage, useL } from '@/shared/i18n';
import { IconButton } from '@/shared/ui/IconButton';
import { PlusIcon } from '@/shared/ui/icons';
import { Progress } from '@/shared/ui/Progress';
import type { PaymentMode } from '@trasolve/shared';
import '@/features/billing/ui/token-plans.css';

type Props = {
  remaining: number;
  allowance: number;
  open: boolean;
  dialogId: string;
  onOpen: () => void;
  mode: PaymentMode;
};

export function TokenBalanceControl({
  remaining,
  allowance,
  open,
  dialogId,
  onOpen,
  mode,
}: Props) {
  const L = useL();
  const number = new Intl.NumberFormat(getLanguage());

  return (
    <div
      className="map-token-balance"
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
          {L('auth:tokenPlans.remaining')}
          {mode !== 'live' && (
            <span className="map-token-preview-label">
              {mode === 'debug'
                ? L('auth:billing.debugMode')
                : L('auth:billing.testMode')}
            </span>
          )}
        </span>
        <span className="map-token-balance-value">
          <strong>{number.format(remaining)}</strong>
          <span>
            {L('auth:tokenPlans.allowanceSuffix', {
              allowance: number.format(allowance),
            })}
          </span>
        </span>
        <Progress
          className="map-token-balance-progress"
          label={L('auth:tokenPlans.remaining')}
          value={remaining}
          max={allowance}
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
