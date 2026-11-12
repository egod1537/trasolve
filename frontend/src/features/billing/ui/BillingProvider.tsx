import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  BillingSummary,
  ConfirmPayment,
  PaymentCheckout,
  PaymentProductId,
} from '@trasolve/shared';
import {
  abandonCheckout,
  BillingRequestError,
  cancelSubscription,
  confirmCheckout,
  createCheckout,
  fetchBillingSummary,
} from '../api/billingApi';
import { createCheckoutProvider } from '../api/checkoutProvider';
import { BillingContext } from '../model/billingContext';
import {
  usePaymentCelebration,
  type PaymentCelebration,
} from '../model/usePaymentCelebration';
import { CheckoutConfirmationDialog } from './CheckoutConfirmationDialog';
import { CancelSubscriptionDialog } from './CancelSubscriptionDialog';
import {
  BILLING_REFRESH_EVENT,
  DEBUG_TOKEN_MODE_KEY,
  isDebugTokenUnlimited,
  setDebugTokenUnlimited,
} from '@/shared/api/billingContext';
import { NL, useL } from '@/shared/i18n';
import { Dialog } from '@/shared/ui/Dialog';
import { Button } from '@/shared/ui/Button';

const TokenPlansDialog = lazy(() =>
  import('./TokenPlansDialog').then((module) => ({
    default: module.TokenPlansDialog,
  })),
);

type Props = { userId: string | null; login: () => void; children: ReactNode };
export function BillingProvider({ userId, login, children }: Props) {
  const L = useL();
  const dialogId = useId();
  const resultId = useId();
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [busy, setBusy] = useState(false);
  const [changingTokenMode, setChangingTokenMode] = useState(false);
  const tokenModeOperation = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [plansOpen, setPlansOpen] = useState(false);
  const [pendingCheckout, setPendingCheckout] =
    useState<PaymentCheckout | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelImmediately, setCancelImmediately] = useState(false);
  const [result, setResult] = useState<ReactNode>(null);
  const [celebration, setCelebration] = useState<PaymentCelebration | null>(
    null,
  );
  usePaymentCelebration(celebration);
  const operation = useRef(false);
  const callbackStarted = useRef(false);
  const revision = useRef(0);

  const refresh = useCallback(async () => {
    const rev = ++revision.current;
    if (!userId) {
      return;
    }
    try {
      const value = await fetchBillingSummary();
      if (rev === revision.current) {
        setSummary(value);
        setError(null);
      }
    } catch (cause) {
      if (rev === revision.current) {
        setError(
          cause instanceof Error ? cause.message : L('auth:billing.error'),
        );
      }
    } finally {
      if (rev === revision.current) {
        setLoading(false);
      }
    }
  }, [userId, L]);

  useEffect(() => {
    const reload = () => {
      void refresh();
    };
    queueMicrotask(reload);
    window.addEventListener(BILLING_REFRESH_EVENT, reload);
    window.addEventListener('focus', reload);
    const storageChanged = (event: StorageEvent) => {
      if (event.key === DEBUG_TOKEN_MODE_KEY || event.key === null) {
        reload();
      }
    };
    window.addEventListener('storage', storageChanged);
    const timer = window.setInterval(reload, 30_000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(BILLING_REFRESH_EVENT, reload);
      window.removeEventListener('focus', reload);
      window.removeEventListener('storage', storageChanged);
    };
  }, [refresh]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    if (!userId || !payment || callbackStarted.current) {
      return;
    }
    callbackStarted.current = true;
    const orderId = params.get('checkout') ?? params.get('orderId') ?? '';
    const authKey = params.get('authKey');
    const customerKey = params.get('customerKey');
    const paymentKey = params.get('paymentKey');
    const amount = Number(params.get('amount'));
    const input: ConfirmPayment = {
      orderId,
      ...(authKey ? { authKey } : {}),
      ...(customerKey ? { customerKey } : {}),
      ...(paymentKey ? { paymentKey, amount } : {}),
    };
    // Copy the callback data, then remove sensitive one-time keys from history.
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
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`,
    );
    void (async () => {
      await Promise.resolve();
      operation.current = true;
      setBusy(true);
      try {
        if (payment !== 'success') {
          if (orderId) {
            await abandonCheckout(orderId);
          }
          setResult(L('auth:billing.cancelled'));
        } else {
          const value = await confirmCheckout(input);
          revision.current++;
          setSummary(value);
          setResult(L('auth:billing.success'));
          setCelebration({ orderId, plan: value.wallet.plan });
        }
      } catch (cause) {
        setResult(
          cause instanceof Error ? cause.message : L('auth:billing.error'),
        );
      } finally {
        operation.current = false;
        setBusy(false);
      }
    })();
  }, [userId, L]);

  const toggleDebugUnlimited = async () => {
    if (
      operation.current ||
      tokenModeOperation.current ||
      summary?.mode !== 'debug' ||
      !summary.unlimitedAvailable
    ) {
      return;
    }
    tokenModeOperation.current = true;
    setChangingTokenMode(true);
    const previous = isDebugTokenUnlimited();
    setDebugTokenUnlimited(!summary.unlimited);
    const rev = ++revision.current;
    try {
      const value = await fetchBillingSummary();
      if (rev === revision.current) {
        setSummary(value);
        setError(null);
      }
    } catch (cause) {
      setDebugTokenUnlimited(previous);
      setResult(
        cause instanceof Error ? cause.message : L('auth:billing.error'),
      );
      void refresh();
    } finally {
      tokenModeOperation.current = false;
      setChangingTokenMode(false);
    }
  };

  const purchase = async (product: PaymentProductId) => {
    if (operation.current || tokenModeOperation.current) {
      return;
    }
    operation.current = true;
    setBusy(true);
    setError(null);
    let order: PaymentCheckout | undefined;
    try {
      order = await createCheckout(product);
      if (
        (await createCheckoutProvider(order.mode).start(order)) === 'confirm'
      ) {
        setPendingCheckout(order);
      }
    } catch (cause) {
      if (order) {
        await abandonCheckout(order.orderId).catch(() => undefined);
      }
      setResult(
        cause instanceof Error ? cause.message : L('auth:billing.error'),
      );
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };
  const finishCheckout = async (outcome: 'success' | 'failure' | 'cancel') => {
    if (
      !pendingCheckout ||
      operation.current ||
      tokenModeOperation.current ||
      (pendingCheckout.mode !== 'debug' && outcome === 'failure')
    ) {
      return;
    }
    operation.current = true;
    setBusy(true);
    setError(null);
    let close = true;
    try {
      const value =
        outcome === 'cancel' && pendingCheckout.mode !== 'debug'
          ? await abandonCheckout(pendingCheckout.orderId)
          : await confirmCheckout({
              orderId: pendingCheckout.orderId,
              ...(pendingCheckout.mode === 'debug' ? { outcome } : {}),
            });
      revision.current++;
      setSummary(value);
      const cancelled =
        outcome === 'cancel' &&
        !(pendingCheckout.upgrade && value.wallet.plan === 'pro');
      setResult(
        cancelled ? L('auth:billing.cancelled') : L('auth:billing.success'),
      );
      if (!cancelled && outcome === 'success') {
        setCelebration({
          orderId: pendingCheckout.orderId,
          plan: value.wallet.plan,
        });
      }
    } catch (cause) {
      // Preserve an uncertain stored-card order so retries reuse its idempotency key.
      const terminal =
        cause instanceof BillingRequestError &&
        ['PAYMENT_DECLINED', 'PAYMENT_CLOSED', 'PAYMENT_EXPIRED'].includes(
          cause.code,
        );
      close = !(
        pendingCheckout.upgrade &&
        pendingCheckout.mode !== 'debug' &&
        !terminal
      );
      setResult(
        cause instanceof Error ? cause.message : L('auth:billing.error'),
      );
    } finally {
      if (close) {
        setPendingCheckout(null);
      }
      operation.current = false;
      setBusy(false);
    }
  };
  const cancel = async () => {
    if (operation.current || tokenModeOperation.current) {
      return;
    }
    operation.current = true;
    setBusy(true);
    setError(null);
    try {
      const value = await cancelSubscription(cancelImmediately);
      revision.current++;
      setSummary(value);
      setResult(
        cancelImmediately ? (
          <>
            {L('auth:tokenPlans.currentPlan')} <strong>{NL('Free')}</strong>
          </>
        ) : (
          L('auth:billing.cancelScheduled')
        ),
      );
    } catch (cause) {
      setResult(
        cause instanceof Error ? cause.message : L('auth:billing.error'),
      );
    } finally {
      setCancelConfirmOpen(false);
      operation.current = false;
      setBusy(false);
    }
  };
  const closePlans = () => {
    if (busy) {
      return;
    }
    if (pendingCheckout) {
      void finishCheckout('cancel').then(() => setPlansOpen(false));
      return;
    }
    setPlansOpen(false);
  };

  return (
    <BillingContext.Provider
      value={{
        summary,
        loading,
        changingTokenMode,
        toggleDebugUnlimited,
        busy,
        error,
        authenticated: Boolean(userId),
        pendingCheckout,
        plansOpen,
        dialogId,
        openPlans: () => {
          setPlansOpen(true);
          void refresh();
        },
        closePlans,
        refresh,
        purchase,
        finishCheckout,
        cancelSubscription: async (immediate = false) => {
          if (!operation.current && !tokenModeOperation.current) {
            setCancelImmediately(immediate);
            setCancelConfirmOpen(true);
          }
        },
        login,
      }}
    >
      {children}
      {plansOpen && (
        <Suspense fallback={null}>
          <TokenPlansDialog />
        </Suspense>
      )}
      {pendingCheckout && <CheckoutConfirmationDialog />}
      {cancelConfirmOpen && (
        <CancelSubscriptionDialog
          busy={busy}
          immediate={cancelImmediately}
          remaining={summary?.wallet.remaining ?? 0}
          endsAt={summary?.wallet.renewsAt ?? null}
          onClose={() => {
            if (!operation.current) {
              setCancelConfirmOpen(false);
            }
          }}
          onConfirm={() => void cancel()}
        />
      )}
      {result && (
        <Dialog
          className="billing-result-dialog"
          labelledBy={resultId}
          onClose={() => setResult(null)}
        >
          <h2 id={resultId}>{L('auth:billing.paymentResult')}</h2>
          <p role="status">{result}</p>
          <Button onClick={() => setResult(null)}>
            {L('common:action.close')}
          </Button>
        </Dialog>
      )}
    </BillingContext.Provider>
  );
}
