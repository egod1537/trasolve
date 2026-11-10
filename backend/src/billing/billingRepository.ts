import { z } from 'zod';
import {
  paymentModeSchema,
  paymentProductSchema,
  tokenWalletSchema,
  type PaymentMode,
} from '@trasolve/shared';

export const billingOrderSchema = z.object({
  id: z.string().uuid(),
  product: paymentProductSchema,
  status: z.enum(['pending', 'paid', 'failed', 'cancelled', 'refunded']),
  customerKey: z.string(),
  createdAt: z.iso.datetime(),
  paymentKey: z.string().optional(),
  billingSecret: z.string().optional(),
  renewal: z.boolean().optional(),
  processingUntil: z.iso.datetime().optional(),
  processingKey: z.string().optional(),
  refundedTokens: z.number().int().nonnegative().optional(),
});
const subscriptionSchema = z.object({
  product: paymentProductSchema,
  billingSecret: z.string(),
  customerKey: z.string(),
  nextAt: z.iso.datetime(),
  cancel: z.boolean(),
  failure: z.boolean(),
  pendingOrderId: z.string().optional(),
  retryAt: z.iso.datetime().optional(),
});
export const billingAccountSchema = z.object({
  wallet: tokenWalletSchema,
  freeGrantAt: z.iso.datetime(),
  orders: z.record(z.string(), billingOrderSchema),
  usage: z.record(
    z.string(),
    z.object({
      amount: z.number().int().nonnegative(),
      action: z.enum(['chat', 'optimize']),
      state: z.enum(['reserved', 'spent', 'released']),
      at: z.iso.datetime(),
    }),
  ),
  ledger: z.array(
    z.object({
      id: z.string(),
      amount: z.number().int(),
      reason: z.string(),
      at: z.iso.datetime(),
    }),
  ),
  subscription: subscriptionSchema.nullable(),
});
export const localBillingSchema = z.record(z.string(), billingAccountSchema);
export type BillingAccount = z.infer<typeof billingAccountSchema>;
export type BillingOrder = z.infer<typeof billingOrderSchema>;
export interface BillingOwner {
  userId: string;
  mode: PaymentMode;
}

export interface BillingRepository {
  transact<T>(
    owner: BillingOwner,
    operation: (account: BillingAccount) => T,
  ): Promise<T>;
  findOrder(orderId: string): Promise<BillingOwner | null>;
  dueSubscriptions(now: string): Promise<BillingOwner[]>;
}

export function initialBillingAccount(): BillingAccount {
  return {
    wallet: {
      provided: 2000,
      remaining: 2000,
      plan: 'free',
      renewsAt: null,
      cancelAtPeriodEnd: false,
    },
    freeGrantAt: nextMonth(new Date()),
    orders: {},
    usage: {},
    ledger: [
      {
        id: 'welcome',
        amount: 2000,
        reason: 'welcome',
        at: new Date().toISOString(),
      },
    ],
    subscription: null,
  };
}

// Clamp dates such as January 31 to the last valid day of the following month.
export function nextMonth(date: Date): string {
  const next = new Date(date);
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const last = new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
  ).getUTCDate();
  next.setUTCDate(Math.min(day, last));
  return next.toISOString();
}

export function parseBillingOwner(key: string): BillingOwner {
  const [userId, mode] = key.split(':');
  return {
    userId: z.uuid().parse(userId),
    mode: paymentModeSchema.parse(mode),
  };
}
