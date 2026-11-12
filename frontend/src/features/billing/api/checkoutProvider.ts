import type { PaymentCheckout } from '@trasolve/shared';
import { L } from '@/shared/i18n';

interface TossPaymentInstance {
  requestPayment(input: {
    method: 'CARD';
    amount: { currency: 'KRW'; value: number };
    orderId: string;
    orderName: string;
    successUrl: string;
    failUrl: string;
  }): Promise<void>;
  requestBillingAuth(input: {
    method: 'CARD';
    successUrl: string;
    failUrl: string;
  }): Promise<void>;
}
type TossFactory = (key: string) => {
  payment(input: { customerKey: string }): TossPaymentInstance;
};

export interface CheckoutProvider {
  start(checkout: PaymentCheckout): Promise<'redirect' | 'confirm'>;
}

class DebugCheckoutProvider implements CheckoutProvider {
  public async start(): Promise<'confirm'> {
    return 'confirm';
  }
}
class TossCheckoutProvider implements CheckoutProvider {
  public async start(order: PaymentCheckout): Promise<'redirect' | 'confirm'> {
    if (order.upgrade) {
      return 'confirm';
    }
    const factory = await loadToss();
    const instance = factory(order.clientKey).payment({
      customerKey: order.customerKey,
    });
    const success = returnUrl('success', order.orderId);
    const fail = returnUrl('failure', order.orderId);
    if (order.product.kind === 'subscription') {
      await instance.requestBillingAuth({
        method: 'CARD',
        successUrl: success,
        failUrl: fail,
      });
    } else {
      await instance.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: order.product.amount },
        orderId: order.orderId,
        orderName: L('auth:billing.tokenPack', {
          tokens: order.product.tokens.toLocaleString(),
        }),
        successUrl: success,
        failUrl: fail,
      });
    }
    return 'redirect';
  }
}

export function createCheckoutProvider(
  mode: PaymentCheckout['mode'],
): CheckoutProvider {
  return mode === 'debug'
    ? new DebugCheckoutProvider()
    : new TossCheckoutProvider();
}

function returnUrl(result: string, orderId: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set('payment', result);
  url.searchParams.set('checkout', orderId);
  return url.toString();
}

let sdk: Promise<TossFactory> | null = null;
function loadToss(): Promise<TossFactory> {
  const global = window as Window & { TossPayments?: TossFactory };
  if (global.TossPayments) {
    return Promise.resolve(global.TossPayments);
  }
  sdk ??= new Promise<TossFactory>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://js.tosspayments.com/v2/standard';
    script.async = true;
    script.onload = () =>
      global.TossPayments
        ? resolve(global.TossPayments)
        : reject(new Error(L('auth:billing.error')));
    script.onerror = () => {
      script.remove();
      sdk = null;
      reject(new Error(L('auth:billing.error')));
    };
    document.head.appendChild(script);
  });
  return sdk;
}
