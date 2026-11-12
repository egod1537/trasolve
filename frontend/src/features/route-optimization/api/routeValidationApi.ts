import {
  API_ROUTES,
  routeValidationResponseSchema,
  type RouteValidationRequest,
  type RouteValidationResponse,
} from '@trasolve/shared';
import { L } from '@/shared/i18n';
import { readApiError } from './optimizationApiErrors';
import { RouteOptimizationApiError } from './optimizationApiTypes';
import { readResponseBody } from './optimizationHttp';
export async function validateDayRoute(
  request: RouteValidationRequest,
  signal: AbortSignal,
): Promise<RouteValidationResponse> {
  const response = await fetch(API_ROUTES.trouteValidate, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: AbortSignal.any([signal, AbortSignal.timeout(35000)]),
  });
  const body = await readResponseBody(response);
  if (!response.ok) {
    throw new RouteOptimizationApiError(
      readApiError(
        body.body,
        L(
          'routeOptimization:routeOptimizationApi.error.errorOccurredWhileCommunicatingTroute',
        ),
      ),
    );
  }
  const parsed = routeValidationResponseSchema.safeParse(body.body);
  if (
    !parsed.success ||
    (request.check_feasibility &&
      parsed.data.input_valid &&
      !parsed.data.feasibility)
  ) {
    throw new RouteOptimizationApiError(
      L(
        'routeOptimization:routeOptimizationApi.error.optimizationStatusResponseFormatIncorrect',
      ),
    );
  }
  return parsed.data;
}
