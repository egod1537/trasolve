import { useEffect, useMemo, useState } from 'react';
import type { RouteValidationResponse, TripDay } from '@trasolve/shared';
import type { RouteOptimizationRequestOptions } from './routeOptimization';
import { prepareRouteValidation } from './routeValidation';
import { validateDayRoute } from '../api/routeValidationApi';
import { RouteOptimizationApiError } from '../api/optimizationApiTypes';
import { useL } from '@/shared/i18n';

type RemoteValidation = {
  key: string;
  result: RouteValidationResponse | null;
  error: string | null;
};
export function useRouteValidation(
  day: TripDay | undefined,
  settings: RouteOptimizationRequestOptions | null,
  paused: boolean,
) {
  const L = useL();
  const prepared = useMemo(
    () => (day && settings ? prepareRouteValidation(day, settings) : null),
    [day, settings],
  );
  const payload = prepared?.request ? JSON.stringify(prepared.request) : null;
  const [attempt, setAttempt] = useState(0);
  const key = payload ? `${attempt}:${payload}` : null;
  const [remote, setRemote] = useState<RemoteValidation | null>(null);
  useEffect(() => {
    if (!key || !payload || paused) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void validateDayRoute(JSON.parse(payload), controller.signal).then(
        (result) => {
          if (!controller.signal.aborted) {
            setRemote({ key, result, error: null });
          }
        },
        (cause: unknown) => {
          if (!controller.signal.aborted) {
            setRemote({
              key,
              result: null,
              error:
                cause instanceof RouteOptimizationApiError
                  ? cause.message
                  : L(
                      'routeOptimization:routeOptimizationApi.readApiError.text.unableConnectRouteOptimizationServer',
                    ),
            });
          }
        },
      );
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [key, payload, paused, L]);
  const current = remote?.key === key ? remote : null;
  return {
    retry: () => setAttempt((current) => current + 1),
    issues: prepared?.issues ?? [],
    result: current?.result ?? null,
    error: current?.error ?? null,
    checking: Boolean(key && !current && !paused),
    unknownHours: prepared?.unknownHours ?? [],
    blocksOptimization: Boolean(
      prepared?.issues.length || current?.result?.blocks_optimization,
    ),
  };
}
export type RouteValidationState = ReturnType<typeof useRouteValidation>;
