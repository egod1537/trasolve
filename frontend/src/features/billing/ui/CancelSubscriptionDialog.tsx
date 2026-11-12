import { useId, useRef } from 'react';
import { getLanguage, NL, useL } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import './billing-checkout-dialog.css';

type Props = {
  busy: boolean;
  immediate?: boolean;
  remaining: number;
  endsAt: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function CancelSubscriptionDialog({
  busy,
  immediate = false,
  remaining,
  endsAt,
  onClose,
  onConfirm,
}: Props) {
  const L = useL();
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      className="billing-checkout-dialog"
      role="alertdialog"
      labelledBy={titleId}
      describedBy={descriptionId}
      initialFocusRef={cancelRef}
      busy={busy}
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
      onClose={onClose}
    >
      <h2 id={titleId}>
        {immediate
          ? L('auth:tokenPlans.selectPlan', { plan: NL('Free') })
          : L('auth:billing.cancelSubscription')}
      </h2>
      <p id={descriptionId} className="billing-checkout-terms">
        {immediate
          ? L('auth:tokenPlans.currentBalance', {
              balance: new Intl.NumberFormat(getLanguage()).format(remaining),
            })
          : L('auth:billing.cancelScheduled')}
      </p>
      {(endsAt || immediate) && (
        <p>
          {L('auth:billing.endsAt', {
            date: new Intl.DateTimeFormat(getLanguage()).format(
              immediate ? new Date() : new Date(endsAt!),
            ),
          })}
        </p>
      )}
      <div className="billing-checkout-actions">
        <Button ref={cancelRef} disabled={busy} onClick={onClose}>
          {L('common:action.cancel')}
        </Button>
        <Button variant="danger" loading={busy} onClick={onConfirm}>
          {L('auth:billing.cancelSubscription')}
        </Button>
      </div>
    </Dialog>
  );
}
