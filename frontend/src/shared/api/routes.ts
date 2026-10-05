import {
  API_ROUTES,
  directionsErrorResponseSchema,
  directionsRequestSchema,
  directionsResultSchema,
  getGoogleMapsLocale,
  type DirectionsDebugDetails,
  type DirectionsRequest,
  type DirectionsResult,
} from '@trasolve/shared';
import { getLanguage, L } from '@/shared/i18n';
import { captureUnexpectedApiException } from '@/shared/observability/sentry';

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
  const localizedRequest = directionsRequestSchema.parse({
    ...request,
    ...getGoogleMapsLocale(getLanguage()),
  });
  const response = await fetch(API_ROUTES.routes, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(localizedRequest),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch (cause) {
    captureUnexpectedApiException(cause, {
      operation: 'directions.parse-response',
      ...(response.ok ? {} : { httpStatus: response.status }),
    });
    throw cause;
  }
  if (!response.ok) {
    const parsed = directionsErrorResponseSchema.safeParse(body);
    if (parsed.success) {
      const error = new DirectionsApiError(
        response.status,
        parsed.data.error.code,
        L('errors:routes.error.routeLookupFailedHttp', {
          status: response.status,
        }),
        parsed.data.error.details,
      );
      captureUnexpectedApiException(
        new Error('DIRECTIONS_UNEXPECTED_HTTP_ERROR'),
        {
          operation: 'directions.request',
          httpStatus: response.status,
        },
      );
      throw error;
    }
    const error = new DirectionsApiError(
      response.status,
      'ROUTES_REQUEST_FAILED',
      L('errors:routes.error.routeLookupFailedHttp', {
        status: response.status,
      }),
    );
    captureUnexpectedApiException(
      new Error('DIRECTIONS_UNEXPECTED_HTTP_ERROR'),
      {
        operation: 'directions.request',
        httpStatus: response.status,
      },
    );
    throw error;
  }
  const parsed = directionsResultSchema.safeParse(body);
  if (!parsed.success) {
    const error = new Error(
      L('errors:routes.error.routeResponseFormatIncorrect'),
    );
    captureUnexpectedApiException(error, {
      operation: 'directions.validate-response',
    });
    throw error;
  }
  return parsed.data;
}
