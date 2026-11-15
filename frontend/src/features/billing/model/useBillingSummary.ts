import { useCallback, useEffect, useRef, useState } from 'react';
import type { BillingSummary } from '@trasolve/shared';
import { fetchBillingSummary } from '../api/billingApi';
import {
  BILLING_REFRESH_EVENT,
  DEBUG_TOKEN_MODE_KEY,
} from '@/shared/api/billingContext';

export function useBillingSummary(
  authenticated: boolean,
  formatFailure: (cause: unknown) => string,
) {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(authenticated);
  const [error, setError] = useState<string | null>(null);
  const revision = useRef(0);
  const mounted = useRef(true);
  const reads = useRef(new Set<AbortController>());
  const invalidate = useCallback(() => {
    revision.current++;
  }, []);
  const beginUpdate = useCallback(() => {
    const rev = ++revision.current;
    const isCurrent = () => mounted.current && rev === revision.current;
    return {
      isCurrent,
      publish: (value: BillingSummary) => {
        if (isCurrent()) {
          setSummary(value);
          setError(null);
          setLoading(false);
        }
      },
    };
  }, []);
  const publish = useCallback(
    (value: BillingSummary) => beginUpdate().publish(value),
    [beginUpdate],
  );
  const clearError = useCallback(() => setError(null), []);
  const refresh = useCallback(async () => {
    if (!authenticated || !mounted.current) {
      return;
    }
    const update = beginUpdate();
    const controller = new AbortController();
    reads.current.add(controller);
    try {
      const value = await fetchBillingSummary(controller.signal);
      update.publish(value);
    } catch (cause) {
      if (update.isCurrent() && !controller.signal.aborted) {
        setError(formatFailure(cause));
      }
    } finally {
      reads.current.delete(controller);
      if (update.isCurrent()) {
        setLoading(false);
      }
    }
  }, [authenticated, beginUpdate, formatFailure]);
  useEffect(() => {
    mounted.current = true;
    let disposed = false;
    const reload = () => {
      if (!disposed) {
        void refresh();
      }
    };
    const storageChanged = (event: StorageEvent) => {
      if (event.key === DEBUG_TOKEN_MODE_KEY || event.key === null) {
        reload();
      }
    };
    queueMicrotask(reload);
    window.addEventListener(BILLING_REFRESH_EVENT, reload);
    window.addEventListener('focus', reload);
    window.addEventListener('storage', storageChanged);
    const timer = window.setInterval(reload, 30_000);
    const activeReads = reads.current;
    return () => {
      disposed = true;
      mounted.current = false;
      invalidate();
      for (const controller of activeReads) {
        controller.abort();
      }
      activeReads.clear();
      window.clearInterval(timer);
      window.removeEventListener(BILLING_REFRESH_EVENT, reload);
      window.removeEventListener('focus', reload);
      window.removeEventListener('storage', storageChanged);
    };
  }, [refresh, invalidate]);
  return { summary, loading, error, publish, beginUpdate, clearError, refresh };
}
