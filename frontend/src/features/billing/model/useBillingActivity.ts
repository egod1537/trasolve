import { useCallback, useEffect, useRef, useState } from 'react';
import type { BillingActivity } from './billingStateTypes';

/** One lock covers checkout, subscription changes and token-mode changes. */
export function useBillingActivity(): BillingActivity {
  const active = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const [kind, setKind] = useState<'payment' | 'tokenMode' | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      active.current?.abort();
      active.current = null;
    };
  }, []);
  const isBusy = useCallback(() => active.current !== null, []);
  const begin = useCallback<BillingActivity['begin']>((nextKind) => {
    if (!mounted.current || active.current) {
      return null;
    }
    const controller = new AbortController();
    active.current = controller;
    setKind(nextKind);
    const isCurrent = () =>
      mounted.current &&
      active.current === controller &&
      !controller.signal.aborted;
    return {
      signal: controller.signal,
      isCurrent,
      finish: () => {
        if (isCurrent()) {
          active.current = null;
          setKind(null);
        }
      },
    };
  }, []);
  return {
    busy: kind === 'payment',
    changingTokenMode: kind === 'tokenMode',
    isBusy,
    begin,
  };
}
