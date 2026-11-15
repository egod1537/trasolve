import type { ConfirmPayment, PaymentMode } from '@trasolve/shared';
import type { BillingOrder } from './billingRepository.js';

export type VerifiedPayment = {
  orderId: string;
  paymentKey: string;
  amount: number;
  currency: string;
  status: 'paid' | 'cancelled' | 'pending';
  refundedAmount?: number;
};
export interface PaymentProvider {
  readonly mode: PaymentMode;
  readonly available: boolean;
  isAvailable(kind: 'subscription' | 'topup'): boolean;
  clientKeyFor(kind: 'subscription' | 'topup'): string;
  issueBillingKey(authKey: string, customerKey: string): Promise<string>;
  approve(
    order: BillingOrder,
    input: ConfirmPayment,
    billingKey?: string,
  ): Promise<VerifiedPayment>;
  lookup(order: BillingOrder): Promise<VerifiedPayment | null>;
  cancel(order: BillingOrder): Promise<void>;
  deleteBillingKey(key: string): Promise<void>;
}

export class BillingError extends Error {
  public constructor(
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(code);
    this.name = 'BillingError';
  }
}
