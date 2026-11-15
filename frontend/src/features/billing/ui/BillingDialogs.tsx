import { lazy, Suspense, useId } from 'react';
import type { BillingSummary } from '@trasolve/shared';
import type { BillingResult } from '../model/billingStateTypes';
import { NL, useL } from '@/shared/i18n';
import { Dialog } from '@/shared/ui/Dialog';
import { Button } from '@/shared/ui/Button';
import { CheckoutConfirmationDialog } from './CheckoutConfirmationDialog';
import { CancelSubscriptionDialog } from './CancelSubscriptionDialog';

const TokenPlansDialog = lazy(() =>
  import('./TokenPlansDialog').then((module) => ({
    default: module.TokenPlansDialog,
  })),
);

type Props = {
  plansOpen: boolean;
  checkoutPending: boolean;
  cancellation: { immediate: boolean } | null;
  busy: boolean;
  summary: BillingSummary | null;
  result: BillingResult | null;
  onCloseCancellation: () => void;
  onConfirmCancellation: () => void;
  onDismissResult: () => void;
};
export function BillingDialogs(props: Props) {
  return (
    <>
      {props.plansOpen && (
        <Suspense fallback={null}>
          <TokenPlansDialog />
        </Suspense>
      )}
      {props.checkoutPending && <CheckoutConfirmationDialog />}
      {props.cancellation && (
        <CancelSubscriptionDialog
          busy={props.busy}
          immediate={props.cancellation.immediate}
          remaining={props.summary?.wallet.remaining ?? 0}
          endsAt={props.summary?.wallet.renewsAt ?? null}
          onClose={props.onCloseCancellation}
          onConfirm={props.onConfirmCancellation}
        />
      )}
      {props.result && (
        <BillingResultDialog
          result={props.result}
          onClose={props.onDismissResult}
        />
      )}
    </>
  );
}

function BillingResultDialog({
  result,
  onClose,
}: {
  result: BillingResult;
  onClose: () => void;
}) {
  const L = useL();
  const titleId = useId();
  const content =
    result.kind === 'error' ? (
      result.message
    ) : result.kind === 'success' ? (
      L('auth:billing.success')
    ) : result.kind === 'cancelled' ? (
      L('auth:billing.cancelled')
    ) : result.kind === 'cancelScheduled' ? (
      L('auth:billing.cancelScheduled')
    ) : (
      <>
        {L('auth:tokenPlans.currentPlan')} <strong>{NL('Free')}</strong>
      </>
    );
  return (
    <Dialog
      className="billing-result-dialog"
      labelledBy={titleId}
      onClose={onClose}
    >
      <h2 id={titleId}>{L('auth:billing.paymentResult')}</h2>
      <p role="status">{content}</p>
      <Button onClick={onClose}>{L('common:action.close')}</Button>
    </Dialog>
  );
}
