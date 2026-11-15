import { useEffect, useRef } from 'react';
import { abandonCheckout, confirmCheckout } from '../api/billingApi';
import type { BillingWorkflow } from './billingStateTypes';
import { parsePaymentReturn } from './paymentReturn';

export function usePaymentReturn(
  authenticated: boolean,
  workflow: BillingWorkflow,
) {
  const started = useRef(false);
  useEffect(() => {
    if (!authenticated || started.current) {
      return;
    }
    const callback = parsePaymentReturn(new URL(window.location.href));
    if (!callback) {
      return;
    }
    started.current = true;
    window.history.replaceState(null, '', callback.cleanUrl);
    void (async () => {
      // Begin after StrictMode's initial effect cleanup/replay, exactly once.
      await Promise.resolve();
      const operation = workflow.activity.begin('payment');
      if (!operation) {
        return;
      }
      try {
        if (!callback.success) {
          if (callback.input.orderId) {
            await abandonCheckout(callback.input.orderId);
          }
          if (operation.isCurrent()) {
            workflow.report({ kind: 'cancelled' });
          }
        } else {
          const value = await confirmCheckout(callback.input);
          if (operation.isCurrent()) {
            workflow.account.publish(value);
            workflow.report({ kind: 'success' });
            workflow.onPaid({
              orderId: callback.input.orderId,
              plan: value.wallet.plan,
            });
          }
        }
      } catch (cause) {
        if (operation.isCurrent()) {
          workflow.report({
            kind: 'error',
            message: workflow.formatFailure(cause),
          });
        }
      } finally {
        operation.finish();
      }
    })();
  }, [authenticated, workflow]);
}
