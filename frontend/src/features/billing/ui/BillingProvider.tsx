import { useCallback, useId, useState, type ReactNode } from 'react';
import { useL } from '@/shared/i18n';
import {
  BillingContext,
  type BillingContextValue,
} from '../model/billingContext';
import type {
  BillingResult,
  PaymentCelebration,
} from '../model/billingStateTypes';
import { useBillingActivity } from '../model/useBillingActivity';
import { useBillingSummary } from '../model/useBillingSummary';
import { useBillingCheckout } from '../model/useBillingCheckout';
import { useBillingSubscription } from '../model/useBillingSubscription';
import { useBillingTokenMode } from '../model/useBillingTokenMode';
import { usePaymentReturn } from '../model/usePaymentReturn';
import { usePaymentCelebration } from './usePaymentCelebration';
import { BillingDialogs } from './BillingDialogs';

type Props = { userId: string | null; login: () => void; children: ReactNode };

export function BillingProvider(props: Props) {
  return (
    <BillingAccountSession key={props.userId ?? 'signed-out'} {...props} />
  );
}

/** Account changes dispose requests, locks and dialogs together. */
function BillingAccountSession({ userId, login, children }: Props) {
  const L = useL();
  const dialogId = useId();
  const formatFailure = useCallback(
    (cause: unknown) =>
      cause instanceof Error ? cause.message : L('auth:billing.error'),
    [L],
  );
  const account = useBillingSummary(Boolean(userId), formatFailure);
  const activity = useBillingActivity();
  const [plansOpen, setPlansOpen] = useState(false);
  const [result, report] = useState<BillingResult | null>(null);
  const [celebration, onPaid] = useState<PaymentCelebration | null>(null);
  const workflow = { account, activity, report, onPaid, formatFailure };
  const checkout = useBillingCheckout(workflow);
  const subscription = useBillingSubscription(workflow);
  const toggleDebugUnlimited = useBillingTokenMode(workflow);
  usePaymentReturn(Boolean(userId), workflow);
  usePaymentCelebration(celebration);
  const closePlans = () => {
    if (activity.busy) {
      return;
    }
    if (checkout.pendingCheckout) {
      void checkout.finishCheckout('cancel').then(() => setPlansOpen(false));
    } else {
      setPlansOpen(false);
    }
  };
  const value: BillingContextValue = {
    summary: account.summary,
    loading: account.loading,
    error: account.error,
    busy: activity.busy,
    changingTokenMode: activity.changingTokenMode,
    toggleDebugUnlimited,
    authenticated: Boolean(userId),
    pendingCheckout: checkout.pendingCheckout,
    plansOpen,
    dialogId,
    openPlans: () => {
      setPlansOpen(true);
      void account.refresh();
    },
    closePlans,
    refresh: account.refresh,
    purchase: checkout.purchase,
    finishCheckout: checkout.finishCheckout,
    cancelSubscription: subscription.requestCancellation,
    login,
  };
  return (
    <BillingContext.Provider value={value}>
      {children}
      <BillingDialogs
        plansOpen={plansOpen}
        checkoutPending={checkout.pendingCheckout !== null}
        cancellation={subscription.confirmation}
        busy={activity.busy}
        summary={account.summary}
        result={result}
        onCloseCancellation={subscription.closeConfirmation}
        onConfirmCancellation={() => void subscription.confirmCancellation()}
        onDismissResult={() => report(null)}
      />
    </BillingContext.Provider>
  );
}
