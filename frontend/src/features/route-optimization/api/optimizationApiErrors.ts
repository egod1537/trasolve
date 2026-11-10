import {
  apiErrorSchema,
  type TrouteJobState,
  type TrouteOptimizeRequest,
} from '@trasolve/shared';
import { reportExternalApiDisabled } from '@/shared/api/externalApiDisabled';
import { L } from '@/shared/i18n';
import { captureUnexpectedApiException } from '@/shared/observability/sentry';
import {
  ROUTE_OPTIMIZATION_API_CONFIG,
  RouteOptimizationApiError,
} from '@/features/route-optimization/api/optimizationApiTypes';

export function formatOptimizationJobError(
  error: TrouteJobState['error'],
): string {
  if (!error) {
    return L(
      'routeOptimization:routeOptimizationApi.formatOptimizationJobError.text.pathOptimizationFailed',
    );
  }

  if (
    error.code === 'NO_FEASIBLE_ROUTE' ||
    error.code === 'NO_FEASIBLE_SCHEDULE' ||
    error.code === 'TIME_WINDOW_VIOLATION'
  ) {
    return L(
      'routeOptimization:routeOptimizationApi.formatOptimizationJobError.text.weCouldNotFindPossibleRoute',
    );
  }

  if (isProviderConfigurationError(error.code)) {
    return L(
      'routeOptimization:routeOptimizationApi.formatOptimizationJobError.text.noRouteLookupProviderSetUp',
    );
  }

  if (error.code === 'ROUTING_PAIR_FAILED') {
    return L(
      'routeOptimization:routeOptimizationApi.formatOptimizationJobError.text.failedRetrieveTravelTimeFromTcache',
    );
  }

  if (isInvalidTimeWindowError(error.code)) {
    return L(
      'routeOptimization:routeOptimizationApi.formatOptimizationJobError.text.locationOpeningHoursVisitingHoursRange',
    );
  }

  const detail = error.detail?.toLowerCase() ?? '';
  if (
    error.code === 'INVALID_REQUEST' &&
    (detail.includes('time window') || detail.includes('open_time'))
  ) {
    return L(
      'routeOptimization:routeOptimizationApi.formatOptimizationJobError.text.locationOpeningHoursVisitingHoursRange',
    );
  }

  if (error.code === 'ROUTING_UNAVAILABLE') {
    if (
      detail.includes('provider') &&
      (detail.includes('not configured') ||
        detail.includes('configuration') ||
        detail.includes('api key'))
    ) {
      return L(
        'routeOptimization:routeOptimizationApi.formatOptimizationJobError.text.noRouteLookupProviderSetUp',
      );
    }
    if (
      detail.includes('place id') &&
      (detail.includes('invalid') || detail.includes('not found'))
    ) {
      return L(
        'routeOptimization:routeOptimizationApi.formatOptimizationJobError.text.routeSearchFailedBecauseThereWas',
      );
    }
    if (
      detail.includes('tcache') &&
      (detail.includes('connection') ||
        detail.includes('refused') ||
        detail.includes('unavailable') ||
        detail.includes('failed to fetch'))
    ) {
      return L(
        'routeOptimization:routeOptimizationApi.formatOptimizationJobError.text.travelTimeCouldNotBeRetrieved',
      );
    }
    if (detail.includes('google_routes_error')) {
      return L(
        'routeOptimization:routeOptimizationApi.formatOptimizationJobError.text.googleRoutesDidnTReturnDirections',
      );
    }
    return L(
      'routeOptimization:routeOptimizationApi.formatOptimizationJobError.text.failedRetrieveTravelTimeFromTcache',
    );
  }

  if (error.code.includes('TIMEOUT')) {
    return L(
      'routeOptimization:routeOptimizationApi.formatOptimizationJobError.text.routeOptimizationProcessingTimedOut',
    );
  }

  return L(
    'routeOptimization:routeOptimizationApi.formatOptimizationJobError.text.pathOptimizationFailed',
  );
}

export function createAbortError(
  userSignal: AbortSignal | undefined,
  timeoutSignal: AbortSignal,
): RouteOptimizationApiError {
  if (timeoutSignal.aborted && !userSignal?.aborted) {
    return new RouteOptimizationApiError(
      L(
        'routeOptimization:routeOptimizationApi.createAbortError.text.routeOptimizationRequestTimeExceededSeconds',
        { value: ROUTE_OPTIMIZATION_API_CONFIG.requestTimeoutMs / 1_000 },
      ),
    );
  }
  return new RouteOptimizationApiError(
    L(
      'routeOptimization:routeOptimizationApi.createAbortError.text.routeOptimizationRequestHasBeenCancelled',
    ),
  );
}

export function readApiError(
  body: unknown,
  fallback: string,
  request?: TrouteOptimizeRequest,
): string {
  const parsed = apiErrorSchema.safeParse(body);
  if (!parsed.success) {
    return fallback;
  }
  const disabledError = reportExternalApiDisabled(body);
  if (disabledError) {
    return disabledError.message;
  }
  const { code, message } = parsed.data.error;
  if (code === 'TROUTE_NOT_CONFIGURED') {
    return L(
      'routeOptimization:routeOptimizationApi.readApiError.text.routeOptimizationServerNotSetUp',
    );
  }
  if (code === 'TROUTE_UNAVAILABLE') {
    return L(
      'routeOptimization:routeOptimizationApi.readApiError.text.unableConnectRouteOptimizationServer',
    );
  }
  if (code === 'TROUTE_TIMEOUT') {
    return L(
      'routeOptimization:routeOptimizationApi.readApiError.text.routeOptimizationRequestTimedOut',
    );
  }
  if (code === 'TROUTE_START_POLICY_UNSUPPORTED') {
    return L(
      'routeOptimization:routeOptimizationApi.readApiError.text.startupMethodNotCurrentlySupportedBy',
      { formatStartPolicy: formatStartPolicy(request?.start_policy) },
    );
  }
  if (isInvalidTimeWindowError(code)) {
    return L(
      'routeOptimization:routeOptimizationApi.formatOptimizationJobError.text.locationOpeningHoursVisitingHoursRange',
    );
  }
  return message;
}

export function captureContractViolation(
  operation: string,
  message: string,
): RouteOptimizationApiError {
  const error = new RouteOptimizationApiError(message);
  captureUnexpectedApiException(error, { operation });
  return error;
}

export function isProviderConfigurationError(code: string): boolean {
  return (
    code === 'PROVIDER_NOT_CONFIGURED' ||
    code === 'ROUTING_PROVIDER_NOT_CONFIGURED' ||
    code === 'ROUTING_CONFIGURATION_ERROR'
  );
}

export function isInvalidTimeWindowError(code: string): boolean {
  return (
    code === 'INVALID_TIME_WINDOW' ||
    code === 'TIME_WINDOW_INVALID' ||
    code === 'INVALID_SCHEDULE_WINDOW'
  );
}

export function formatStartPolicy(
  policy: TrouteOptimizeRequest['start_policy'] | undefined,
): string {
  switch (policy) {
    case 'FIXED':
      return L(
        'routeOptimization:routeOptimizationApi.formatStartPolicy.text.designatedTime',
      );
    case 'EARLIEST':
      return L(
        'routeOptimization:routeOptimizationApi.formatStartPolicy.text.asSoonAsPossible',
      );
    case 'LATEST':
      return L(
        'routeOptimization:routeOptimizationApi.formatStartPolicy.text.asLateAsPossible',
      );
    default:
      return L(
        'routeOptimization:routeOptimizationApi.formatStartPolicy.text.selected',
      );
  }
}
