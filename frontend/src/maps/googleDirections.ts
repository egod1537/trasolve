import {
  API_ROUTES,
  apiErrorSchema,
  directionsResultSchema,
  type DirectionsRequest,
  type DirectionsResult,
} from '@trasolve/shared';

export type {
  DirectionsRequest,
  DirectionsResult,
  MapRoute,
  RouteLocation,
  TravelMode,
} from '@trasolve/shared';

export async function getDirections(
  request: DirectionsRequest,
): Promise<DirectionsResult> {
  const response = await fetch(API_ROUTES.routes, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(20000),
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(body);
    throw new Error(
      parsed.success
        ? `${parsed.data.error.code}: ${parsed.data.error.message}`
        : `경로 조회 실패 (HTTP ${response.status})`,
    );
  }
  const parsed = directionsResultSchema.safeParse(body);
  if (!parsed.success) throw new Error('경로 응답 형식이 올바르지 않습니다.');
  return parsed.data;
}
