import type { ConfirmPayment } from '@trasolve/shared';
import type { BillingOrder } from './billingRepository.js';
import {
  BillingError,
  type PaymentProvider,
  type VerifiedPayment,
} from './paymentProvider.js';

// Explicit developer feature, selected only by the server's debug-mode gate.
export class DebugPaymentProvider implements PaymentProvider {
  public readonly mode = 'debug' as const;
  public readonly clientKey = '';
  public readonly available = true;
  public isAvailable(): boolean {
    return true;
  }
  public clientKeyFor(): string {
    return '';
  }
  public async issueBillingKey(): Promise<string> {
    return 'debug-billing';
  }
  public async approve(
    order: BillingOrder,
    input: ConfirmPayment,
  ): Promise<VerifiedPayment> {
    if (input.outcome === 'failure') {
      throw new BillingError('PAYMENT_DECLINED');
    }
    return {
      orderId: order.id,
      paymentKey: `debug_${order.id}`,
      amount: order.product.amount,
      currency: 'KRW',
      status: input.outcome === 'cancel' ? 'cancelled' : 'paid',
    };
  }
  public async lookup(): Promise<null> {
    return null;
  }
  public async cancel(): Promise<void> {}
  public async deleteBillingKey(): Promise<void> {}
}
