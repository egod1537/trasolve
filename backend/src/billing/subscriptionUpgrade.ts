import type { PaymentProduct } from '@trasolve/shared';
import type { BillingAccount, BillingOrder } from './billingRepository.js';
import { BillingError } from './paymentProvider.js';

export function releaseExpiredUpgrade(account: BillingAccount): void {
  const sub = account.subscription;
  const id = sub?.upgradeOrderId;
  if (!sub || !id) {
    return;
  }
  const order = account.orders[id];
  if (
    order?.status === 'pending' &&
    !order.attemptedAt &&
    Date.now() - Date.parse(order.createdAt) > 30 * 60_000 &&
    !(order.processingUntil && order.processingUntil > new Date().toISOString())
  ) {
    order.status = 'cancelled';
  }
  if (!order || order.status !== 'pending') {
    delete sub.upgradeOrderId;
  }
}

export function canUpgrade(
  account: BillingAccount,
  target: PaymentProduct,
): boolean {
  const sub = account.subscription;
  return Boolean(
    sub &&
    sub.product.id === 'plus' &&
    target.id === 'pro' &&
    !sub.pendingOrderId &&
    sub.billingSecret &&
    target.amount > sub.product.amount &&
    target.tokens > sub.product.tokens &&
    (sub.nextAt > new Date().toISOString() || sub.upgradeOrderId),
  );
}

export function assertCurrentUpgrade(
  account: BillingAccount,
  order: BillingOrder,
): void {
  const change = order.upgrade;
  const sub = account.subscription;
  if (
    !change ||
    !sub ||
    sub.upgradeOrderId !== order.id ||
    sub.id !== change.subscriptionId ||
    sub.product.id !== 'plus' ||
    sub.nextAt !== change.periodEnd ||
    sub.pendingOrderId
  ) {
    throw new BillingError('PAYMENT_CLOSED', 409);
  }
}

export function clearUpgrade(
  account: BillingAccount,
  order: BillingOrder,
): void {
  if (account.subscription?.upgradeOrderId === order.id) {
    delete account.subscription.upgradeOrderId;
  }
}

export function applyUpgrade(
  account: BillingAccount,
  order: BillingOrder,
): void {
  assertCurrentUpgrade(account, order);
  const sub = account.subscription!;
  sub.product = order.upgrade!.targetProduct;
  sub.lastUpgradeOrderId = order.id;
  sub.cancel = false;
  sub.failure = false;
  delete sub.retryAt;
  clearUpgrade(account, order);
  account.wallet.plan = 'pro';
  account.wallet.cancelAtPeriodEnd = false;
  // Preserve the original cycle and billing key; only the delta was purchased.
}

export function refundUpgrade(
  account: BillingAccount,
  order: BillingOrder,
): void {
  const change = order.upgrade;
  const sub = account.subscription;
  if (
    !change ||
    !sub ||
    sub.id !== change.subscriptionId ||
    sub.nextAt !== change.periodEnd ||
    sub.product.id !== 'pro' ||
    sub.lastUpgradeOrderId !== order.id ||
    order.refundedTokens !== order.product.tokens
  ) {
    return;
  }
  sub.product = change.previousProduct;
  delete sub.lastUpgradeOrderId;
  sub.cancel = sub.cancel || change.previousCancel;
  account.wallet.plan = 'plus';
  account.wallet.cancelAtPeriodEnd = sub.cancel;
}
