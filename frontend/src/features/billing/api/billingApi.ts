import {
  API_ROUTES,
  billingSummarySchema,
  checkoutSchema,
  type ConfirmPayment,
  type PaymentProductId,
} from '@trasolve/shared';
import { billingHeaders, withBillingMode } from '@/shared/api/billingContext';
import { readBillingError } from '@/shared/api/billingErrors';
import { L } from '@/shared/i18n';

export async function billingRequest(
  path: string,
  body?: unknown,
): Promise<unknown> {
  const response = await fetch(
    withBillingMode(`${API_ROUTES.billing}${path}`),
    {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      headers: { ...billingHeaders(), 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(60000),
    },
  );
  const result: unknown = await response.json();
  if (!response.ok) {
    throw new Error(readBillingError(result) ?? L('auth:billing.error'));
  }
  return result;
}
export async function fetchBillingSummary() {
  return billingSummarySchema.parse(await billingRequest('/summary'));
}
export async function createCheckout(productId: PaymentProductId) {
  return checkoutSchema.parse(await billingRequest('/orders', { productId }));
}
export async function confirmCheckout(input: ConfirmPayment) {
  return billingSummarySchema.parse(await billingRequest('/confirm', input));
}
export async function cancelSubscription() {
  return billingSummarySchema.parse(
    await billingRequest('/subscription/cancel', {}),
  );
}
export async function abandonCheckout(orderId: string) {
  return billingRequest(`/orders/${encodeURIComponent(orderId)}/abort`, {});
}
