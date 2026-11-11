import type { MapRoute } from '@trasolve/shared';
import { DirectionsApiError } from '@/shared/api/routes';

export type RouteQueryFailure = {
  kind: 'not-found' | 'timeout' | 'configuration' | 'unavailable';
  code: string;
  httpStatus: number | null;
};

export type RouteQueryState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; routes: readonly MapRoute[] }
  | { status: 'error'; failure: RouteQueryFailure };

export function toRouteQueryFailure(error: unknown): RouteQueryFailure {
  if (error instanceof DirectionsApiError) {
    return {
      kind:
        error.code === 'ROUTE_NOT_FOUND'
          ? 'not-found'
          : error.code === 'ROUTES_TIMEOUT'
            ? 'timeout'
            : error.code === 'ROUTES_NOT_CONFIGURED' ||
                error.code === 'PROVIDER_NOT_CONFIGURED'
              ? 'configuration'
              : 'unavailable',
      code: error.code,
      httpStatus: error.httpStatus,
    };
  }
  const timedOut = error instanceof Error && error.name === 'TimeoutError';
  return {
    kind: timedOut ? 'timeout' : 'unavailable',
    code: timedOut ? 'ROUTES_TIMEOUT' : 'ROUTES_UNAVAILABLE',
    httpStatus: null,
  };
}
