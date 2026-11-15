import { z } from 'zod';
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

export class BillingRequestError extends Error {
  public constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'BillingRequestError';
  }
}
const billingErrorSchema = z.object({ error: z.object({ code: z.string() }) });

export async function billingRequest(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetch(
    withBillingMode(`${API_ROUTES.billing}${path}`),
    {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      headers: { ...billingHeaders(), 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(60000)])
        : AbortSignal.timeout(60000),
    },
  );
  const result: unknown = await response.json();
  if (!response.ok) {
    const error = billingErrorSchema.safeParse(result);
    throw new BillingRequestError(
      error.success ? error.data.error.code : 'PAYMENT_UNAVAILABLE',
      response.status,
      readBillingError(result) ?? L('auth:billing.error'),
    );
  }
  return result;
}
export async function fetchBillingSummary(signal?: AbortSignal) {
  return billingSummarySchema.parse(
    await billingRequest('/summary', undefined, signal),
  );
}
export async function createCheckout(productId: PaymentProductId) {
  return checkoutSchema.parse(await billingRequest('/orders', { productId }));
}
export async function confirmCheckout(input: ConfirmPayment) {
  return billingSummarySchema.parse(await billingRequest('/confirm', input));
}
export async function cancelSubscription(immediate = false) {
  return billingSummarySchema.parse(
    await billingRequest('/subscription/cancel', { immediate }),
  );
}
export async function abandonCheckout(orderId: string) {
  return billingSummarySchema.parse(
    await billingRequest(`/orders/${encodeURIComponent(orderId)}/abort`, {}),
  );
}
