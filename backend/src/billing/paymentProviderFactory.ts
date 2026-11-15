import { DebugPaymentProvider } from './debugPaymentProvider.js';
import { TossPaymentProvider } from './tossPaymentProvider.js';
import type { PaymentProvider } from './paymentProvider.js';

// The composition root is the only place selecting concrete payment adapters.
// Adding another PG does not change wallet, entitlement or ledger operations.
export function createPaymentProviders(): {
  normal: PaymentProvider;
  debug: PaymentProvider;
} {
  return {
    normal: new TossPaymentProvider(
      process.env.TOSS_PAYMENTS_SECRET_KEY?.trim() ?? '',
      process.env.TOSS_PAYMENTS_CLIENT_KEY?.trim() ?? '',
      process.env.TOSS_BILLING_SECRET_KEY?.trim() ?? '',
      process.env.TOSS_BILLING_CLIENT_KEY?.trim() ?? '',
    ),
    debug: new DebugPaymentProvider(),
  };
}
