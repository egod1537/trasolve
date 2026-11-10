import {
  API_ROUTES,
  trouteJobStateSchema,
  type TrouteJobState,
  type TrouteOptimizeResponse,
} from '@trasolve/shared';
import { L } from '@/shared/i18n';
import { captureUnexpectedApiException } from '@/shared/observability/sentry';
import {
  ROUTE_OPTIMIZATION_API_CONFIG,
  type ParsedResponseBody,
  RouteOptimizationApiError,
} from '@/features/route-optimization/api/optimizationApiTypes';
import {
  formatOptimizationJobError,
  readApiError,
  captureContractViolation,
} from '@/features/route-optimization/api/optimizationApiErrors';

export async function getOptimizationJobState(
  jobId: string,
  signal: AbortSignal,
): Promise<TrouteJobState> {
  const response = await fetch(
    `${API_ROUTES.trouteJobs}/${encodeURIComponent(jobId)}`,
    { signal },
  );
  const responseBody = await readResponseBody(response);
  if (!response.ok) {
    const error = new RouteOptimizationApiError(
      readApiError(
        responseBody.body,
        L(
          'routeOptimization:routeOptimizationApi.error.optimizationStatusQueryFailedHttp',
          { status: response.status },
        ),
      ),
    );
    captureUnexpectedApiException(
      new Error('ROUTE_OPTIMIZATION_UNEXPECTED_HTTP_ERROR'),
      {
        operation: 'route-optimization.get-job',
        httpStatus: response.status,
      },
    );
    throw error;
  }
  const parsed = trouteJobStateSchema.safeParse(responseBody.body);
  if (!responseBody.isJson || !parsed.success || parsed.data.job_id !== jobId) {
    throw captureContractViolation(
      'route-optimization.validate-job',
      L(
        'routeOptimization:routeOptimizationApi.error.optimizationStatusResponseFormatIncorrect',
      ),
    );
  }
  return parsed.data;
}

export function getOptimizationResult(
  state: TrouteJobState,
): TrouteOptimizeResponse {
  if (state.status === 'completed') {
    if (state.result) {
      return state.result;
    }
    throw captureContractViolation(
      'route-optimization.completed-without-result',
      L(
        'routeOptimization:routeOptimizationApi.error.completedOptimizationJobHasNoResults',
      ),
    );
  }
  if (state.status === 'failed') {
    throw new RouteOptimizationApiError(
      formatOptimizationJobError(state.error),
      state.error,
    );
  }
  if (state.status === 'cancelled') {
    throw new RouteOptimizationApiError(
      L(
        'routeOptimization:routeOptimizationApi.error.routeOptimizationHasBeenCancelled',
      ),
    );
  }
  throw captureContractViolation(
    'route-optimization.non-terminal-result',
    L(
      'routeOptimization:routeOptimizationApi.error.optimizationProgressConnectionTerminatedWithoutResult',
    ),
  );
}

export async function cancelOptimizationJob(jobId: string): Promise<void> {
  try {
    await fetch(
      `${API_ROUTES.trouteJobs}/${encodeURIComponent(jobId)}/cancel`,
      {
        method: 'POST',
        signal: AbortSignal.timeout(
          ROUTE_OPTIMIZATION_API_CONFIG.cancelTimeoutMs,
        ),
      },
    );
  } catch {
    // 원래 abort/timeout 오류를 유지하기 위한 best-effort 취소 요청이다.
  }
}

export async function readResponseBody(
  response: Response,
): Promise<ParsedResponseBody> {
  const text = await response.text();
  if (text.trim().length === 0) {
    return { body: null, isJson: false };
  }
  try {
    return { body: JSON.parse(text) as unknown, isJson: true };
  } catch {
    return { body: null, isJson: false };
  }
}
