import { fetchBillingSummary } from '../api/billingApi';
import {
  isDebugTokenUnlimited,
  setDebugTokenUnlimited,
} from '@/shared/api/billingContext';
import type { BillingWorkflow } from './billingStateTypes';

export function useBillingTokenMode({
  account,
  activity,
  report,
  formatFailure,
}: BillingWorkflow) {
  return async () => {
    const { summary } = account;
    if (summary?.mode !== 'debug' || !summary.unlimitedAvailable) {
      return;
    }
    const operation = activity.begin('tokenMode');
    if (!operation) {
      return;
    }
    const previous = isDebugTokenUnlimited();
    setDebugTokenUnlimited(!summary.unlimited);
    const update = account.beginUpdate();
    try {
      const value = await fetchBillingSummary(operation.signal);
      if (operation.isCurrent()) {
        update.publish(value);
      }
    } catch (cause) {
      if (operation.isCurrent()) {
        setDebugTokenUnlimited(previous);
        report({ kind: 'error', message: formatFailure(cause) });
        void account.refresh();
      }
    } finally {
      operation.finish();
    }
  };
}
