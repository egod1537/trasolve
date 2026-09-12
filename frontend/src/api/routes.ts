import {
  API_ROUTES,
  directionsErrorResponseSchema,
  directionsRequestSchema,
  directionsResultSchema,
  type DirectionsDebugDetails,
  type DirectionsRequest,
  type DirectionsResult,
} from '@trasolve/shared';

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
        parsed.data.error.message,
        parsed.data.error.details,
      );
    }
    throw new DirectionsApiError(
      response.status,
      'ROUTES_REQUEST_FAILED',
      `경로 조회 실패 (HTTP ${response.status})`,
    );
  }
  const parsed = directionsResultSchema.safeParse(body);
  if (!parsed.success) throw new Error('경로 응답 형식이 올바르지 않습니다.');
  return parsed.data;
}
