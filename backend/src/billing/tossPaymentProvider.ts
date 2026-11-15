import { z } from 'zod';
import type { ConfirmPayment, PaymentMode } from '@trasolve/shared';
import type { BillingOrder } from './billingRepository.js';
import {
  BillingError,
  type PaymentProvider,
  type VerifiedPayment,
} from './paymentProvider.js';

// Definitive card/billing rejections only; duplicate IDs and outages stay uncertain.
// Source: https://docs.tosspayments.com/reference/error-codes (card automatic approval).
const declinedCodes = new Set([
  'INVALID_STOPPED_CARD',
  'INVALID_REJECT_CARD',
  'INVALID_CARD_EXPIRATION',
  'INVALID_CARD_NUMBER',
  'INVALID_BILL_KEY_REQUEST',
  'NOT_SUPPORTED_CARD_TYPE',
  'NOT_MATCHES_CUSTOMER_KEY',
  'NOT_REGISTERED_CARD_COMPANY',
  'INVALID_CARD_LOST_OR_STOLEN',
  'REJECT_CARD_PAYMENT',
  'REJECT_ACCOUNT_PAYMENT',
  'REJECT_CARD_COMPANY',
  'EXCEED_MAX_AUTH_COUNT',
  'KYC_BLOCKED',
]);
const providerErrorSchema = z.object({ code: z.string() });

const responseSchema = z.object({
  orderId: z.string(),
  paymentKey: z.string(),
  totalAmount: z.number().int(),
  currency: z.string(),
  status: z.string(),
  balanceAmount: z.number().int().nonnegative(),
});

export class TossPaymentProvider implements PaymentProvider {
  public constructor(
    private readonly secretKey: string,
    private readonly clientKey: string,
    private readonly billingSecretKey: string,
    private readonly billingClientKey: string,
  ) {
    const keys = [secretKey, clientKey, billingSecretKey, billingClientKey];
    if (
      keys.some((k) => k.startsWith('live_')) &&
      keys.some((k) => k.startsWith('test_'))
    ) {
      throw new Error(
        'Toss normal and billing keys must use the same test/live environment.',
      );
    }
    this.mode = keys.some((k) => k.startsWith('live_')) ? 'live' : 'sandbox';
  }
  public readonly mode: PaymentMode;
  public get available(): boolean {
    return this.isAvailable('topup') || this.isAvailable('subscription');
  }
  public isAvailable(kind: 'subscription' | 'topup'): boolean {
    const secret =
      kind === 'subscription' ? this.billingSecretKey : this.secretKey;
    const client =
      kind === 'subscription' ? this.billingClientKey : this.clientKey;
    return (
      /^(test|live)_sk_/.test(secret) &&
      /^(test|live)_ck_/.test(client) &&
      secret.split('_')[0] === client.split('_')[0] &&
      (process.env.TRASOLVE_EXTERNAL_API_MODE ?? 'enabled') === 'enabled'
    );
  }
  public clientKeyFor(kind: 'subscription' | 'topup'): string {
    if (!this.isAvailable(kind)) {
      throw new BillingError('PAYMENT_NOT_CONFIGURED', 503);
    }
    return kind === 'subscription' ? this.billingClientKey : this.clientKey;
  }

  public async issueBillingKey(
    authKey: string,
    customerKey: string,
  ): Promise<string> {
    const value = z
      .object({ billingKey: z.string(), customerKey: z.string() })
      .parse(
        await this.request(
          '/v1/billing/authorizations/issue',
          'POST',
          { authKey, customerKey },
          undefined,
          false,
          true,
        ),
      );
    if (value.customerKey !== customerKey) {
      throw new BillingError('PAYMENT_MISMATCH', 502);
    }
    return value.billingKey;
  }

  public async approve(
    order: BillingOrder,
    input: ConfirmPayment,
    billingKey?: string,
  ): Promise<VerifiedPayment> {
    const existing = await this.lookup(order);
    if (existing?.status === 'paid' || existing?.status === 'cancelled') {
      return existing;
    }
    if (billingKey) {
      return this.payment(
        await this.request(
          `/v1/billing/${encodeURIComponent(billingKey)}`,
          'POST',
          {
            customerKey: order.customerKey,
            amount: order.product.amount,
            orderId: order.id,
            orderName:
              order.product.id === 'pro' ? 'Trasolve Pro' : 'Trasolve Plus',
          },
          order.id,
          false,
          true,
        ),
      );
    }
    if (!input.paymentKey || input.amount !== order.product.amount) {
      throw new BillingError('PAYMENT_MISMATCH');
    }
    return this.payment(
      await this.request(
        '/v1/payments/confirm',
        'POST',
        {
          paymentKey: input.paymentKey,
          amount: order.product.amount,
          orderId: order.id,
        },
        order.id,
      ),
    );
  }

  public async lookup(order: BillingOrder): Promise<VerifiedPayment | null> {
    const result = await this.request(
      `/v1/payments/orders/${encodeURIComponent(order.id)}`,
      'GET',
      undefined,
      undefined,
      true,
      order.product.kind === 'subscription',
    );
    return result === null ? null : this.payment(result);
  }
  public async cancel(order: BillingOrder): Promise<void> {
    if (!order.paymentKey) {
      throw new BillingError('INVALID_PAYMENT');
    }
    await this.request(
      `/v1/payments/${encodeURIComponent(order.paymentKey)}/cancel`,
      'POST',
      { cancelReason: 'Customer cancellation' },
      `cancel_${order.id}`,
      false,
      order.product.kind === 'subscription',
    );
  }
  public async deleteBillingKey(key: string): Promise<void> {
    await this.request(
      `/v1/billing/${encodeURIComponent(key)}`,
      'DELETE',
      undefined,
      undefined,
      false,
      true,
    );
  }

  private payment(raw: unknown): VerifiedPayment {
    const p = responseSchema.parse(raw);
    return {
      orderId: p.orderId,
      paymentKey: p.paymentKey,
      amount: p.totalAmount,
      currency: p.currency,
      refundedAmount: p.totalAmount - p.balanceAmount,
      status:
        p.status === 'DONE'
          ? 'paid'
          : ['CANCELED', 'PARTIAL_CANCELED'].includes(p.status)
            ? 'cancelled'
            : 'pending',
    };
  }
  private async request(
    path: string,
    method: string,
    body?: unknown,
    idempotencyKey?: string,
    allowMissing = false,
    billing = false,
  ): Promise<unknown> {
    if (!this.isAvailable(billing ? 'subscription' : 'topup')) {
      throw new BillingError('PAYMENT_NOT_CONFIGURED', 503);
    }
    if ((process.env.TRASOLVE_EXTERNAL_API_MODE ?? 'enabled') !== 'enabled') {
      throw new BillingError('PAYMENT_NOT_CONFIGURED', 503);
    }
    const response = await fetch(`https://api.tosspayments.com${path}`, {
      method,
      signal: AbortSignal.timeout(20000),
      headers: {
        Authorization: `Basic ${Buffer.from(`${billing ? this.billingSecretKey : this.secretKey}:`).toString('base64')}`,
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (allowMissing && response.status === 404) {
      return null;
    }
    if (!response.ok) {
      if (
        billing &&
        method === 'POST' &&
        response.status >= 400 &&
        response.status < 500
      ) {
        const error = providerErrorSchema.safeParse(
          await response.json().catch(() => null),
        );
        if (error.success && declinedCodes.has(error.data.code)) {
          throw new BillingError('PAYMENT_DECLINED', 400);
        }
      }
      throw new BillingError('PAYMENT_PROVIDER_ERROR', 502);
    }
    if (response.status === 204) {
      return null;
    }
    return response.json();
  }
}
