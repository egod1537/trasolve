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
  cancelSubscription,
  confirmCheckout,
  createCheckout,
  fetchBillingSummary,
} from '../api/billingApi';
import { createCheckoutProvider } from '../api/checkoutProvider';
import { BillingContext } from '../model/billingContext';
import { BILLING_REFRESH_EVENT } from '@/shared/api/billingContext';
import { useL } from '@/shared/i18n';
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
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [plansOpen, setPlansOpen] = useState(false);
  const [debugCheckout, setDebugCheckout] = useState<PaymentCheckout | null>(
    null,
  );
  const [result, setResult] = useState<string | null>(null);
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
    const timer = window.setInterval(reload, 30_000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(BILLING_REFRESH_EVENT, reload);
      window.removeEventListener('focus', reload);
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

  const purchase = async (product: PaymentProductId) => {
    if (operation.current) {
      return;
    }
    operation.current = true;
    setBusy(true);
    setError(null);
    setMessage(null);
    let order: PaymentCheckout | undefined;
    try {
      order = await createCheckout(product);
      if ((await createCheckoutProvider(order.mode).start(order)) === 'debug') {
        setDebugCheckout(order);
      }
    } catch (cause) {
      if (order) {
        await abandonCheckout(order.orderId).catch(() => undefined);
      }
      setError(
        cause instanceof Error ? cause.message : L('auth:billing.error'),
      );
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };
  const finishDebug = async (outcome: 'success' | 'failure' | 'cancel') => {
    if (!debugCheckout || operation.current) {
      return;
    }
    operation.current = true;
    setBusy(true);
    setError(null);
    try {
      const value = await confirmCheckout({
        orderId: debugCheckout.orderId,
        outcome,
      });
      revision.current++;
      setSummary(value);
      setMessage(
        outcome === 'cancel'
          ? L('auth:billing.cancelled')
          : L('auth:billing.success'),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : L('auth:billing.error'),
      );
    } finally {
      setDebugCheckout(null);
      operation.current = false;
      setBusy(false);
    }
  };
  const cancel = async () => {
    if (operation.current) {
      return;
    }
    operation.current = true;
    setBusy(true);
    setError(null);
    try {
      const value = await cancelSubscription();
      revision.current++;
      setSummary(value);
      setMessage(L('auth:billing.cancelScheduled'));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : L('auth:billing.error'),
      );
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };
  const closePlans = () => {
    if (busy) {
      return;
    }
    if (debugCheckout) {
      void finishDebug('cancel').then(() => setPlansOpen(false));
      return;
    }
    setPlansOpen(false);
  };

  return (
    <BillingContext.Provider
      value={{
        summary,
        loading,
        busy,
        error,
        message,
        authenticated: Boolean(userId),
        debugCheckout,
        plansOpen,
        dialogId,
        openPlans: () => {
          setPlansOpen(true);
          setMessage(null);
          void refresh();
        },
        closePlans,
        refresh,
        purchase,
        finishDebug,
        cancelSubscription: cancel,
        login,
      }}
    >
      {children}
      {plansOpen && (
        <Suspense fallback={null}>
          <TokenPlansDialog />
        </Suspense>
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
