import {
  releaseExpiredUpgrade,
  canUpgrade,
  assertCurrentUpgrade,
  clearUpgrade,
  applyUpgrade,
  refundUpgrade,
} from './subscriptionUpgrade.js';
import { TokenPricing, type ModelTokenUsage } from './tokenPricing.js';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import type {
  BillingSummary,
  ConfirmPayment,
  PaymentCheckout,
  PaymentMode,
  PaymentProduct,
  PaymentProductId,
  TokenAction,
} from '@trasolve/shared';
import {
  nextMonth,
  type BillingAccount,
  type BillingOrder,
  type BillingOwner,
  type BillingRepository,
} from './billingRepository.js';
import {
  BillingError,
  type PaymentProvider,
  type VerifiedPayment,
} from './paymentProvider.js';
import { isTokenUsageUnlimited } from './tokenUsagePolicy.js';

function integerSetting(name: string, fallback: number): number {
  const value = process.env[name]?.trim();
  const parsed = value ? Number(value) : fallback;
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 10_000_000) {
    throw new Error(`${name} must be a positive integer up to 10000000.`);
  }
  return parsed;
}

export class BillingService {
  public constructor(
    private readonly repository: BillingRepository,
    private readonly normal: PaymentProvider,
    private readonly debug: PaymentProvider,
  ) {}

  public readonly pricing = new TokenPricing();

  public owner(userId: string, debugRequested = false): BillingOwner {
    if (debugRequested && !this.debugEnabled) {
      throw new BillingError('PAYMENT_DEBUG_DISABLED', 403);
    }
    return { userId, mode: debugRequested ? 'debug' : this.normal.mode };
  }

  public isUsageUnlimited(owner: BillingOwner, requested = false): boolean {
    return isTokenUsageUnlimited(owner.mode, requested);
  }

  public async summary(
    owner: BillingOwner,
    unlimitedRequested = false,
  ): Promise<BillingSummary> {
    const unlimited = this.isUsageUnlimited(owner, unlimitedRequested);
    return this.repository.transact(owner, (account) => {
      releaseExpiredUpgrade(account);
      this.refreshFreeAllowance(account);
      const now = Date.now();
      for (const [key, usage] of Object.entries(account.usage)) {
        if (
          usage.state === 'reserved' &&
          now - Date.parse(usage.at) > 15 * 60_000
        ) {
          account.wallet.remaining += usage.amount;
          usage.state = 'released';
          this.ledger(
            account,
            `release:${key}`,
            usage.amount,
            'expired-reservation',
          );
        }
      }
      return {
        mode: owner.mode,
        unlimited,
        unlimitedAvailable: this.isUsageUnlimited(owner, true),
        available: this.provider(owner.mode).available,
        subscriptionAvailable:
          this.provider(owner.mode).isAvailable('subscription') &&
          (owner.mode === 'debug' ||
            Buffer.from(
              process.env.TRASOLVE_PAYMENT_ENCRYPTION_KEY ?? '',
              'base64',
            ).length === 32),
        upgradeAvailable: canUpgrade(
          account,
          this.products.find((p) => p.id === 'pro')!,
        ),
        topupAvailable: this.provider(owner.mode).isAvailable('topup'),
        wallet: account.wallet,
        costs: unlimited ? { chat: 0, optimize: 0 } : this.costs,
        routeTokenPolicy: this.pricing.routePolicy,
        products: this.products,
      };
    });
  }

  public async createOrder(
    owner: BillingOwner,
    productId: PaymentProductId,
  ): Promise<PaymentCheckout> {
    const provider = this.provider(owner.mode);
    if (!provider.available) {
      throw new BillingError('PAYMENT_NOT_CONFIGURED', 503);
    }
    const catalogProduct = this.products.find((p) => p.id === productId);
    if (!catalogProduct) {
      throw new BillingError('INVALID_PAYMENT');
    }
    if (!provider.isAvailable(catalogProduct.kind)) {
      throw new BillingError('PAYMENT_NOT_CONFIGURED', 503);
    }
    if (catalogProduct.kind === 'subscription' && owner.mode !== 'debug') {
      this.encryptionKey();
    }
    return this.repository.transact(owner, (account) => {
      releaseExpiredUpgrade(account);
      let product = catalogProduct;
      let upgrade: BillingOrder['upgrade'];
      let billingSecret: string | undefined;
      const sub = account.subscription;
      if (catalogProduct.kind === 'subscription' && sub) {
        const pending = sub.upgradeOrderId
          ? account.orders[sub.upgradeOrderId]
          : undefined;
        if (
          pending?.status === 'pending' &&
          pending.upgrade?.targetProduct.id === catalogProduct.id
        ) {
          return this.checkout(owner, pending);
        }
        if (!canUpgrade(account, catalogProduct)) {
          throw new BillingError('SUBSCRIPTION_EXISTS', 409);
        }
        sub.id ??= randomUUID();
        upgrade = {
          subscriptionId: sub.id,
          previousProduct: sub.product,
          targetProduct: catalogProduct,
          periodEnd: sub.nextAt,
          previousCancel: sub.cancel,
        };
        product = {
          ...catalogProduct,
          amount: catalogProduct.amount - sub.product.amount,
          tokens: catalogProduct.tokens - sub.product.tokens,
        };
        billingSecret = sub.billingSecret;
      }
      if (
        catalogProduct.kind === 'subscription' &&
        Object.values(account.orders).some(
          (o) =>
            o.product.kind === 'subscription' &&
            o.status === 'pending' &&
            !o.renewal &&
            (Date.now() - Date.parse(o.createdAt) < 30 * 60_000 ||
              Boolean(
                o.processingUntil &&
                o.processingUntil > new Date().toISOString(),
              )),
        )
      ) {
        throw new BillingError('PAYMENT_PENDING', 409);
      }
      const order: BillingOrder = {
        id: randomUUID(),
        product,
        ...(upgrade ? { upgrade, billingSecret } : {}),
        status: 'pending',
        customerKey: upgrade
          ? sub!.customerKey
          : `usr_${owner.userId}_${owner.mode}`,
        createdAt: new Date().toISOString(),
      };
      account.orders[order.id] = order;
      if (upgrade) {
        account.subscription!.upgradeOrderId = order.id;
      }
      return this.checkout(owner, order);
    });
  }

  public async confirm(
    owner: BillingOwner,
    input: ConfirmPayment,
  ): Promise<BillingSummary> {
    const lease = randomUUID();
    let order = await this.repository.transact(owner, (a) => {
      const current = a.orders[input.orderId];
      if (!current) {
        throw new BillingError('PAYMENT_NOT_FOUND', 404);
      }
      if (current.status === 'paid') {
        return current;
      }
      if (
        current.processingUntil &&
        current.processingUntil > new Date().toISOString()
      ) {
        throw new BillingError('PAYMENT_PENDING', 409);
      }
      if (current.status !== 'pending') {
        throw new BillingError('PAYMENT_CLOSED', 409);
      }
      if (current.upgrade) {
        assertCurrentUpgrade(a, current);
      }
      current.processingUntil = new Date(Date.now() + 120_000).toISOString();
      current.processingKey = lease;
      return current;
    });
    if (order.status === 'paid') {
      return this.summary(owner);
    }
    try {
      const provider = this.provider(owner.mode);
      if (owner.mode !== 'debug' && input.outcome) {
        throw new BillingError('INVALID_PAYMENT');
      }
      if (input.customerKey && input.customerKey !== order.customerKey) {
        throw new BillingError('PAYMENT_MISMATCH');
      }
      if (
        !order.renewal &&
        !order.attemptedAt &&
        Date.now() - Date.parse(order.createdAt) > 30 * 60_000
      ) {
        throw new BillingError('PAYMENT_EXPIRED', 409);
      }
      if (
        order.upgrade &&
        order.upgrade.periodEnd <= new Date().toISOString()
      ) {
        const observed = await provider.lookup(order);
        if (observed && observed.status !== 'pending') {
          await this.applyVerified(owner, order.id, observed);
          return this.summary(owner);
        }
        throw new BillingError('PAYMENT_EXPIRED', 409);
      }
      if (order.product.kind === 'subscription' && !order.billingSecret) {
        if (
          owner.mode !== 'debug' &&
          (!input.authKey || input.customerKey !== order.customerKey)
        ) {
          throw new BillingError('INVALID_PAYMENT');
        }
        const key = await provider.issueBillingKey(
          input.authKey ?? '',
          order.customerKey,
        );
        const encrypted = this.seal(key, owner.mode);
        order = await this.repository.transact(owner, (account) => {
          const current = account.orders[order.id]!;
          current.billingSecret ??= encrypted;
          return current;
        });
      }
      if (order.upgrade) {
        order = await this.repository.transact(owner, (account) => {
          const current = account.orders[order.id]!;
          assertCurrentUpgrade(account, current);
          current.attemptedAt ??= new Date().toISOString();
          return current;
        });
      }
      const verified = await provider.approve(
        order,
        input,
        order.billingSecret
          ? this.unseal(order.billingSecret, owner.mode)
          : undefined,
      );
      await this.applyVerified(owner, order.id, verified);
      return this.summary(owner);
    } catch (cause) {
      if (
        (owner.mode === 'debug' && input.outcome === 'failure') ||
        (cause instanceof BillingError && cause.code === 'PAYMENT_DECLINED')
      ) {
        await this.repository.transact(owner, (a) => {
          if (a.orders[order.id]?.status === 'pending') {
            a.orders[order.id]!.status = 'failed';
            clearUpgrade(a, a.orders[order.id]!);
            if (a.subscription?.pendingOrderId === order.id) {
              delete a.subscription.pendingOrderId;
            }
          }
        });
      }
      if (
        order.upgrade &&
        !order.attemptedAt &&
        cause instanceof BillingError &&
        cause.code === 'PAYMENT_EXPIRED'
      ) {
        await this.repository.transact(owner, (account) => {
          const current = account.orders[order.id]!;
          if (current.status === 'pending') {
            current.status = 'cancelled';
            clearUpgrade(account, current);
          }
        });
      }
      throw cause;
    } finally {
      await this.repository.transact(owner, (a) => {
        const current = a.orders[order.id];
        if (current?.processingKey === lease) {
          delete current.processingKey;
          delete current.processingUntil;
        }
      });
    }
  }

  public async reconcile(orderId: string): Promise<void> {
    const owner = await this.repository.findOrder(orderId);
    if (!owner || owner.mode === 'debug' || owner.mode !== this.normal.mode) {
      return;
    }
    const order = await this.getOrder(owner, orderId);
    const verified = await this.provider(owner.mode).lookup(order);
    if (verified && verified.status !== 'pending') {
      await this.applyVerified(owner, orderId, verified);
    }
  }

  public async cancelSubscription(
    owner: BillingOwner,
    immediate = false,
  ): Promise<BillingSummary> {
    if (immediate && owner.mode !== 'debug') {
      throw new BillingError('PAYMENT_FORBIDDEN', 403);
    }
    await this.repository.transact(owner, (account) => {
      if (!account.subscription) {
        throw new BillingError('SUBSCRIPTION_MISSING', 404);
      }
      releaseExpiredUpgrade(account);
      if (immediate) {
        const pending = Object.values(account.orders).filter(
          (order) =>
            order.product.kind === 'subscription' && order.status === 'pending',
        );
        if (
          pending.some(
            (order) =>
              order.processingUntil &&
              order.processingUntil > new Date().toISOString(),
          )
        ) {
          throw new BillingError('PAYMENT_PENDING', 409);
        }
        for (const order of pending) {
          order.status = 'cancelled';
        }
        account.freeGrantAt = account.subscription.nextAt;
        account.subscription = null;
        account.wallet.plan = 'free';
        account.wallet.renewsAt = null;
        account.wallet.cancelAtPeriodEnd = false;
        return;
      }
      if (
        account.subscription.pendingOrderId ||
        account.subscription.upgradeOrderId
      ) {
        throw new BillingError('PAYMENT_PENDING', 409);
      }
      account.subscription.cancel = true;
      account.wallet.cancelAtPeriodEnd = true;
    });
    return this.summary(owner);
  }

  public async abandon(owner: BillingOwner, orderId: string): Promise<void> {
    const order = await this.getOrder(owner, orderId);
    if (order.status !== 'pending') {
      return;
    }
    const payment = await this.provider(owner.mode).lookup(order);
    if (
      order.upgrade &&
      order.attemptedAt &&
      (!payment || payment.status === 'pending')
    ) {
      throw new BillingError('PAYMENT_PENDING', 409);
    }
    if (payment && payment.status !== 'pending') {
      await this.applyVerified(owner, orderId, payment);
      return;
    }
    await this.repository.transact(owner, (a) => {
      if (
        a.orders[orderId]?.processingUntil &&
        a.orders[orderId]!.processingUntil! > new Date().toISOString()
      ) {
        throw new BillingError('PAYMENT_PENDING', 409);
      }
      if (a.orders[orderId]?.status === 'pending') {
        a.orders[orderId]!.status = 'cancelled';
        clearUpgrade(a, a.orders[orderId]!);
      }
    });
  }

  public async reserve(
    owner: BillingOwner,
    action: TokenAction,
    key: string,
    quotedAmount: number,
  ): Promise<void> {
    await this.repository.transact(owner, (account) => {
      releaseExpiredUpgrade(account);
      this.refreshFreeAllowance(account);
      if (Object.hasOwn(account.usage, key)) {
        throw new BillingError('TOKEN_REQUEST_REPLAY', 409);
      }
      if (!Number.isSafeInteger(quotedAmount) || quotedAmount < 1) {
        throw new BillingError('INVALID_TOKEN_COST');
      }
      const amount =
        action === 'chat'
          ? Math.min(quotedAmount, Math.max(0, account.wallet.remaining))
          : quotedAmount;
      if (amount < 1) {
        throw new BillingError('TOKENS_INSUFFICIENT', 402);
      }
      if (account.wallet.remaining < amount) {
        throw new BillingError('TOKENS_INSUFFICIENT', 402);
      }
      account.wallet.remaining -= amount;
      account.usage[key] = {
        amount,
        action,
        state: 'reserved',
        at: new Date().toISOString(),
      };
      this.ledger(account, `reserve:${key}`, -amount, action);
    });
  }

  public async settle(
    owner: BillingOwner,
    key: string,
    success: boolean,
    actualAmount?: number,
    calls?: readonly ModelTokenUsage[],
  ): Promise<void> {
    await this.repository.transact(owner, (account) => {
      const usage = account.usage[key];
      if (!usage || usage.state !== 'reserved') {
        return;
      }
      if (
        actualAmount !== undefined &&
        (!Number.isSafeInteger(actualAmount) || actualAmount < 0)
      ) {
        throw new BillingError('INVALID_TOKEN_COST');
      }
      const charged = success
        ? Math.min(usage.amount, actualAmount ?? usage.amount)
        : 0;
      const refund = usage.amount - charged;
      usage.state = success ? 'spent' : 'released';
      if (refund > 0) {
        account.wallet.remaining += refund;
        this.ledger(
          account,
          `release:${key}`,
          refund,
          success ? 'usage-adjustment' : 'request-failed',
        );
      }
      if (success) {
        usage.amount = charged;
      }
      if (calls) {
        usage.modelUsage = [...calls];
      }
    });
  }

  public async renewDue(): Promise<void> {
    if (this.renewing) {
      return;
    }
    this.renewing = true;
    try {
      for (const owner of await this.repository.dueSubscriptions(
        new Date().toISOString(),
      )) {
        if (
          owner.mode !== this.normal.mode &&
          !(owner.mode === 'debug' && this.debugEnabled)
        ) {
          continue;
        }
        try {
          await this.renew(owner);
        } catch (cause) {
          if (
            cause instanceof BillingError &&
            cause.code === 'PAYMENT_PENDING'
          ) {
            continue;
          }
          // Preserve the same order/idempotency key after uncertain provider
          // failures. Retrying later cannot bill a second invoice for this cycle.
          await this.repository.transact(owner, (a) => {
            if (a.subscription) {
              a.subscription.failure = true;
              a.subscription.retryAt = new Date(
                Date.now() + 24 * 60 * 60_000,
              ).toISOString();
            }
          });
          console.warn('Subscription renewal deferred.', { mode: owner.mode });
        }
      }
    } finally {
      this.renewing = false;
    }
  }

  private checkout(owner: BillingOwner, order: BillingOrder): PaymentCheckout {
    return {
      orderId: order.id,
      product: order.product,
      customerKey: order.customerKey,
      clientKey: this.provider(owner.mode).clientKeyFor(order.product.kind),
      mode: owner.mode,
      ...(order.upgrade
        ? {
            upgrade: {
              from: 'plus' as const,
              nextProduct: order.upgrade.targetProduct,
              renewsAt: order.upgrade.periodEnd,
            },
          }
        : {}),
    };
  }

  private get debugEnabled(): boolean {
    return (
      process.env.TRASOLVE_DEBUG_PAYMENTS !== 'false' &&
      this.normal.mode !== 'live'
    );
  }
  private get costs() {
    return { chat: 1, optimize: this.pricing.quoteRoute(10) };
  }
  private readonly products: PaymentProduct[] = [
    {
      id: 'plus',
      kind: 'subscription',
      amount: integerSetting('TRASOLVE_PLUS_PRICE', 4900),
      tokens: 20000,
    },
    {
      id: 'pro',
      kind: 'subscription',
      amount: integerSetting('TRASOLVE_PRO_PRICE', 9900),
      tokens: 50000,
    },
    {
      id: 'tokens20k',
      kind: 'topup',
      amount: integerSetting('TRASOLVE_TOPUP_20K_PRICE', 4900),
      tokens: 20000,
    },
    {
      id: 'tokens50k',
      kind: 'topup',
      amount: integerSetting('TRASOLVE_TOPUP_50K_PRICE', 9900),
      tokens: 50000,
    },
  ];
  private renewing = false;

  private provider(mode: PaymentMode): PaymentProvider {
    if (mode === 'debug' && this.debugEnabled) {
      return this.debug;
    }
    if (mode === this.normal.mode) {
      return this.normal;
    }
    throw new BillingError('PAYMENT_DEBUG_DISABLED', 403);
  }
  private getOrder(owner: BillingOwner, id: string): Promise<BillingOrder> {
    return this.repository.transact(owner, (a) => {
      const order = Object.hasOwn(a.orders, id) ? a.orders[id] : undefined;
      if (!order) {
        throw new BillingError('PAYMENT_NOT_FOUND', 404);
      }
      return order;
    });
  }
  private async applyVerified(
    owner: BillingOwner,
    id: string,
    result: VerifiedPayment,
  ): Promise<void> {
    await this.repository.transact(owner, (account) => {
      const order = account.orders[id];
      if (
        !order ||
        result.orderId !== order.id ||
        result.amount !== order.product.amount ||
        result.currency !== 'KRW'
      ) {
        throw new BillingError('PAYMENT_MISMATCH', 502);
      }
      if (result.status === 'pending') {
        throw new BillingError('PAYMENT_PENDING', 409);
      }
      if (result.status === 'cancelled') {
        if (order.status === 'paid' || order.status === 'refunded') {
          const refundedAmount = result.refundedAmount ?? order.product.amount;
          const revokedTokens = Math.max(
            order.refundedTokens ?? 0,
            Math.min(
              order.product.tokens,
              Math.ceil(
                (order.product.tokens * Math.max(0, refundedAmount)) /
                  order.product.amount,
              ),
            ),
          );
          const delta = Math.max(
            0,
            revokedTokens - (order.refundedTokens ?? 0),
          );
          account.wallet.remaining -= delta;
          account.wallet.provided = Math.max(
            0,
            account.wallet.provided - delta,
          );
          if (delta > 0) {
            this.ledger(
              account,
              `refund:${id}:${revokedTokens}`,
              -delta,
              'payment-refund',
            );
          }
          order.refundedTokens = revokedTokens;
          order.status =
            revokedTokens === order.product.tokens ? 'refunded' : 'paid';
          if (order.upgrade) {
            refundUpgrade(account, order);
          } else if (
            order.product.kind === 'subscription' &&
            account.subscription
          ) {
            account.subscription.cancel = true;
            account.wallet.cancelAtPeriodEnd = true;
          }
        } else if (order.status === 'pending') {
          order.status = 'cancelled';
          clearUpgrade(account, order);
          if (
            order.renewal &&
            account.subscription?.pendingOrderId === order.id
          ) {
            account.subscription.cancel = true;
            delete account.subscription.pendingOrderId;
          }
        }
        return;
      }
      if (order.status === 'paid') {
        return;
      }
      if (order.status !== 'pending') {
        throw new BillingError('PAYMENT_CLOSED', 409);
      }
      if (
        order.product.kind === 'subscription' &&
        !order.renewal &&
        !order.upgrade &&
        account.subscription
      ) {
        throw new BillingError('SUBSCRIPTION_EXISTS', 409);
      }
      if (order.upgrade) {
        assertCurrentUpgrade(account, order);
      }
      order.status = 'paid';
      order.paymentKey = result.paymentKey;
      this.credit(account, order.product.tokens, `payment:${id}`, 'payment');
      if (order.upgrade) {
        applyUpgrade(account, order);
      } else if (order.product.kind === 'subscription') {
        if (!order.billingSecret) {
          throw new BillingError('INVALID_PAYMENT');
        }
        const nextAt = nextMonth(new Date());
        const cancel = account.subscription?.cancel ?? false;
        account.subscription = {
          id: account.subscription?.id ?? randomUUID(),
          product: order.product,
          billingSecret: order.billingSecret,
          customerKey: order.customerKey,
          nextAt,
          cancel,
          failure: false,
        };
        account.wallet.plan = order.product.id === 'pro' ? 'pro' : 'plus';
        account.wallet.renewsAt = nextAt;
        account.wallet.cancelAtPeriodEnd = cancel;
      }
    });
  }
  private async renew(owner: BillingOwner): Promise<void> {
    const selected = await this.repository.transact(owner, (a) => {
      releaseExpiredUpgrade(a);
      const sub = a.subscription;
      if (sub?.upgradeOrderId) {
        return { pendingUpgrade: sub.upgradeOrderId };
      }
      const now = new Date().toISOString();
      if (!sub || sub.nextAt > now || (sub.retryAt && sub.retryAt > now)) {
        return null;
      }
      if (sub.cancel) {
        a.subscription = null;
        a.wallet.plan = 'free';
        a.wallet.renewsAt = null;
        a.wallet.cancelAtPeriodEnd = false;
        a.freeGrantAt = nextMonth(new Date());
        this.credit(a, 2000, `free:${now}`, 'free-period');
        return { cancelledKey: sub.billingSecret };
      }
      const id = sub.pendingOrderId ?? randomUUID();
      sub.pendingOrderId = id;
      a.orders[id] ??= {
        id,
        product: sub.product,
        customerKey: sub.customerKey,
        billingSecret: sub.billingSecret,
        status: 'pending',
        createdAt: now,
        renewal: true,
      };
      return { order: a.orders[id]! };
    });
    if (!selected) {
      return;
    }
    if ('pendingUpgrade' in selected && selected.pendingUpgrade) {
      const order = await this.getOrder(owner, selected.pendingUpgrade);
      const observed = await this.provider(owner.mode).lookup(order);
      if (observed && observed.status !== 'pending') {
        await this.applyVerified(owner, order.id, observed);
      }
      return;
    }
    if ('cancelledKey' in selected && selected.cancelledKey) {
      await this.provider(owner.mode).deleteBillingKey(
        this.unseal(selected.cancelledKey, owner.mode),
      );
      return;
    }
    if ('order' in selected && selected.order) {
      const o = selected.order;
      await this.confirm(owner, { orderId: o.id });
    }
  }
  private refreshFreeAllowance(account: BillingAccount): void {
    if (
      account.subscription ||
      account.freeGrantAt > new Date().toISOString()
    ) {
      return;
    }
    // Unused free periods do not accumulate while an account is inactive.
    const key = `free:${account.freeGrantAt}`;
    account.freeGrantAt = nextMonth(new Date());
    this.credit(account, 2000, key, 'free-period');
  }
  private credit(
    account: BillingAccount,
    amount: number,
    id: string,
    reason: string,
  ): void {
    account.wallet.provided += amount;
    account.wallet.remaining += amount;
    this.ledger(account, id, amount, reason);
  }
  private ledger(
    account: BillingAccount,
    id: string,
    amount: number,
    reason: string,
  ): void {
    account.ledger.push({ id, amount, reason, at: new Date().toISOString() });
  }
  private encryptionKey(): Buffer {
    const key = Buffer.from(
      process.env.TRASOLVE_PAYMENT_ENCRYPTION_KEY ?? '',
      'base64',
    );
    if (key.length !== 32) {
      throw new BillingError('PAYMENT_NOT_CONFIGURED', 503);
    }
    return key;
  }
  private seal(value: string, mode: PaymentMode): string {
    if (mode === 'debug') {
      return value;
    }
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
  }
  private unseal(value: string, mode: PaymentMode): string {
    if (mode === 'debug') {
      return value;
    }
    const raw = Buffer.from(value, 'base64'),
      decipher = createDecipheriv(
        'aes-256-gcm',
        this.encryptionKey(),
        raw.subarray(0, 12),
      );
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([
      decipher.update(raw.subarray(28)),
      decipher.final(),
    ]).toString('utf8');
  }
}
