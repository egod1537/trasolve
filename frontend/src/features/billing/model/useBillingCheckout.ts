import { useState } from 'react';
import type { PaymentCheckout, PaymentProductId } from '@trasolve/shared';
import {
  abandonCheckout,
  confirmCheckout,
  createCheckout,
} from '../api/billingApi';
import { createCheckoutProvider } from '../api/checkoutProvider';
import type { BillingWorkflow } from './billingStateTypes';
import { getCheckoutResult, keepCheckoutForRetry } from './checkoutOutcome';

export function useBillingCheckout({
  account,
  activity,
  report,
  onPaid,
  formatFailure,
}: BillingWorkflow) {
  const [pendingCheckout, setPendingCheckout] =
    useState<PaymentCheckout | null>(null);
  const purchase = async (product: PaymentProductId) => {
    const operation = activity.begin('payment');
    if (!operation) {
      return;
    }
    account.clearError();
    let order: PaymentCheckout | undefined;
    try {
      order = await createCheckout(product);
      if (!operation.isCurrent()) {
        return;
      }
      const outcome = await createCheckoutProvider(order.mode).start(
        order,
        operation.signal,
      );
      if (operation.isCurrent() && outcome === 'confirm') {
        setPendingCheckout(order);
      }
    } catch (cause) {
      if (!operation.isCurrent()) {
        return;
      }
      if (order) {
        await abandonCheckout(order.orderId).catch(() => undefined);
      }
      if (operation.isCurrent()) {
        report({ kind: 'error', message: formatFailure(cause) });
      }
    } finally {
      operation.finish();
    }
  };
  const finishCheckout = async (outcome: 'success' | 'failure' | 'cancel') => {
    if (
      !pendingCheckout ||
      (pendingCheckout.mode !== 'debug' && outcome === 'failure')
    ) {
      return;
    }
    const operation = activity.begin('payment');
    if (!operation) {
      return;
    }
    account.clearError();
    let close = true;
    try {
      const value =
        outcome === 'cancel' && pendingCheckout.mode !== 'debug'
          ? await abandonCheckout(pendingCheckout.orderId)
          : await confirmCheckout({
              orderId: pendingCheckout.orderId,
              ...(pendingCheckout.mode === 'debug' ? { outcome } : {}),
            });
      if (!operation.isCurrent()) {
        return;
      }
      account.publish(value);
      const result = getCheckoutResult(pendingCheckout, outcome, value);
      report(result);
      if (result.kind === 'success' && outcome === 'success') {
        onPaid({ orderId: pendingCheckout.orderId, plan: value.wallet.plan });
      }
    } catch (cause) {
      // Keep the same order/idempotency key when a stored-card result is uncertain.
      close = !keepCheckoutForRetry(pendingCheckout, cause);
      if (operation.isCurrent()) {
        report({ kind: 'error', message: formatFailure(cause) });
      }
    } finally {
      if (operation.isCurrent() && close) {
        setPendingCheckout(null);
      }
      operation.finish();
    }
  };
  return { pendingCheckout, purchase, finishCheckout };
}
