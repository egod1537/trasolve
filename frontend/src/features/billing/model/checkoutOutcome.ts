import type { BillingSummary, PaymentCheckout } from '@trasolve/shared';
import { BillingRequestError } from '../api/billingApi';
import type { BillingResult } from './billingStateTypes';

export function getCheckoutResult(
  order: PaymentCheckout,
  outcome: 'success' | 'failure' | 'cancel',
  summary: BillingSummary,
): BillingResult {
  const cancelled =
    outcome === 'cancel' && !(order.upgrade && summary.wallet.plan === 'pro');
  return { kind: cancelled ? 'cancelled' : 'success' };
}

export function keepCheckoutForRetry(
  order: PaymentCheckout,
  cause: unknown,
): boolean {
  const terminal =
    cause instanceof BillingRequestError &&
    ['PAYMENT_DECLINED', 'PAYMENT_CLOSED', 'PAYMENT_EXPIRED'].includes(
      cause.code,
    );
  return Boolean(order.upgrade && order.mode !== 'debug' && !terminal);
}
