import { useState } from 'react';
import { cancelSubscription } from '../api/billingApi';
import type { BillingWorkflow } from './billingStateTypes';

export function useBillingSubscription({
  account,
  activity,
  report,
  formatFailure,
}: BillingWorkflow) {
  const [confirmation, setConfirmation] = useState<{
    immediate: boolean;
  } | null>(null);
  const requestCancellation = async (immediate = false) => {
    if (!activity.isBusy()) {
      setConfirmation({ immediate });
    }
  };
  const closeConfirmation = () => {
    if (!activity.isBusy()) {
      setConfirmation(null);
    }
  };
  const confirmCancellation = async () => {
    if (!confirmation) {
      return;
    }
    const operation = activity.begin('payment');
    if (!operation) {
      return;
    }
    account.clearError();
    try {
      const value = await cancelSubscription(confirmation.immediate);
      if (operation.isCurrent()) {
        account.publish(value);
        report({ kind: confirmation.immediate ? 'free' : 'cancelScheduled' });
      }
    } catch (cause) {
      if (operation.isCurrent()) {
        report({ kind: 'error', message: formatFailure(cause) });
      }
    } finally {
      if (operation.isCurrent()) {
        setConfirmation(null);
      }
      operation.finish();
    }
  };
  return {
    confirmation,
    requestCancellation,
    closeConfirmation,
    confirmCancellation,
  };
}
