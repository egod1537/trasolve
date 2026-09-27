import {
  API_ROUTES,
  directionsErrorResponseSchema,
  directionsRequestSchema,
  directionsResultSchema,
  type DirectionsDebugDetails,
  type DirectionsRequest,
  type DirectionsResult,
} from '@trasolve/shared';
import { L } from '@/shared/i18n';

export class DirectionsApiError extends Error {
  public constructor(
    public readonly httpStatus: number,
    public readonly code: string,
    message: string,
    public readonly details?: DirectionsDebugDetails,
  ) {
    super(message);
    this.name = 'DirectionsApiError';
  }
}

export async function getDirections(
  request: DirectionsRequest,
  signal?: AbortSignal,
): Promise<DirectionsResult> {
  const timeout = AbortSignal.timeout(20000);
  const response = await fetch(API_ROUTES.routes, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(directionsRequestSchema.parse(request)),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const parsed = directionsErrorResponseSchema.safeParse(body);
    if (parsed.success) {
      throw new DirectionsApiError(
        response.status,
        parsed.data.error.code,
        L('errors:routes.error.routeLookupFailedHttp', {
          status: response.status,
        }),
        parsed.data.error.details,
      );
    }
    throw new DirectionsApiError(
      response.status,
      'ROUTES_REQUEST_FAILED',
      L('errors:routes.error.routeLookupFailedHttp', {
        status: response.status,
      }),
    );
  }
  const parsed = directionsResultSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(L('errors:routes.error.routeResponseFormatIncorrect'));
  }
  return parsed.data;
}
