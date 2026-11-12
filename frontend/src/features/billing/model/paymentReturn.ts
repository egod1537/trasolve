import type { PaymentReturn } from './billingStateTypes';

/** Copy callback data before removing one-time payment keys from browser history. */
export function parsePaymentReturn(url: URL): PaymentReturn | null {
  const params = new URLSearchParams(url.search);
  const payment = params.get('payment');
  if (!payment) {
    return null;
  }
  const orderId = params.get('checkout') ?? params.get('orderId') ?? '';
  const authKey = params.get('authKey');
  const customerKey = params.get('customerKey');
  const paymentKey = params.get('paymentKey');
  const amount = Number(params.get('amount'));
  const input = {
    orderId,
    ...(authKey ? { authKey } : {}),
    ...(customerKey ? { customerKey } : {}),
    ...(paymentKey ? { paymentKey, amount } : {}),
  };
  for (const key of [
    'payment',
    'checkout',
    'orderId',
    'authKey',
    'customerKey',
    'paymentKey',
    'amount',
    'code',
    'message',
  ]) {
    params.delete(key);
  }
  const query = params.toString();
  return {
    success: payment === 'success',
    input,
    cleanUrl: `${url.pathname}${query ? `?${query}` : ''}${url.hash}`,
  };
}
