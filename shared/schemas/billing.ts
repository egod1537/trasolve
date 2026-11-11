import { z } from 'zod';

export const paymentModeSchema = z.enum(['live', 'sandbox', 'debug']);
export const tokenActionSchema = z.enum(['chat', 'optimize']);
export const paidPlanSchema = z.enum(['plus', 'pro']);
export const paymentProductIdSchema = z.enum([
  'plus',
  'pro',
  'tokens20k',
  'tokens50k',
]);
export const paymentProductSchema = z.object({
  id: paymentProductIdSchema,
  kind: z.enum(['subscription', 'topup']),
  amount: z.number().int().positive(),
  tokens: z.number().int().positive(),
});
export const tokenWalletSchema = z.object({
  provided: z.number().int().nonnegative(),
  remaining: z.number().int(),
  plan: z.enum(['free', 'plus', 'pro']),
  renewsAt: z.iso.datetime().nullable(),
  cancelAtPeriodEnd: z.boolean(),
});
export const billingSummarySchema = z.object({
  mode: paymentModeSchema,
  /** Server-owned policy; missing on older servers means metered usage. */
  unlimited: z.boolean().optional(),
  available: z.boolean(),
  subscriptionAvailable: z.boolean(),
  topupAvailable: z.boolean(),
  wallet: tokenWalletSchema,
  costs: z.object({
    chat: z.number().int().nonnegative(),
    optimize: z.number().int().nonnegative(),
  }),
  products: z.array(paymentProductSchema),
});
export const checkoutSchema = z.object({
  orderId: z.string(),
  product: paymentProductSchema,
  customerKey: z.string(),
  clientKey: z.string(),
  mode: paymentModeSchema,
});
export const createPaymentSchema = z.strictObject({
  productId: paymentProductIdSchema,
});
export const confirmPaymentSchema = z.strictObject({
  orderId: z.string().uuid(),
  paymentKey: z.string().min(1).max(200).optional(),
  amount: z.number().int().positive().optional(),
  authKey: z.string().min(1).max(1000).optional(),
  customerKey: z.string().min(1).max(300).optional(),
  outcome: z.enum(['success', 'failure', 'cancel']).optional(),
});
export type PaymentMode = z.infer<typeof paymentModeSchema>;
export type TokenAction = z.infer<typeof tokenActionSchema>;
export type PaidPlan = z.infer<typeof paidPlanSchema>;
export type PaymentProductId = z.infer<typeof paymentProductIdSchema>;
export type PaymentProduct = z.infer<typeof paymentProductSchema>;
export type TokenWallet = z.infer<typeof tokenWalletSchema>;
export type BillingSummary = z.infer<typeof billingSummarySchema>;
export type PaymentCheckout = z.infer<typeof checkoutSchema>;
export type ConfirmPayment = z.infer<typeof confirmPaymentSchema>;
