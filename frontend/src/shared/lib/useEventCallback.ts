import { useCallback, useLayoutEffect, useRef } from 'react';

/** Stable UI event identity with the latest committed handler, never a stale render. */
export function useEventCallback<Args extends unknown[], Result>(
  handler: (...args: Args) => Result,
): (...args: Args) => Result {
  const handlerRef = useRef(handler);
  useLayoutEffect(() => {
    handlerRef.current = handler;
  }, [handler]);
  return useCallback((...args: Args) => handlerRef.current(...args), []);
}
