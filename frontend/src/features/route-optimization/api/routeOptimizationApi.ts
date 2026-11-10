import {
  API_ROUTES,
  trouteJobSubmissionResponseSchema,
  trouteOptimizeRequestSchema,
  trouteOptimizeResponseSchema,
  type TrouteJobState,
  type TrouteOptimizeRequest,
  type TrouteOptimizeResponse,
} from '@trasolve/shared';
import { L } from '@/shared/i18n';
import {
  billingHeaders,
  notifyBillingChanged,
  withBillingMode,
} from '@/shared/api/billingContext';
import { readBillingError } from '@/shared/api/billingErrors';
import { captureUnexpectedApiException } from '@/shared/observability/sentry';
import {
  ROUTE_OPTIMIZATION_API_CONFIG,
  RouteOptimizationApiError,
  type RouteOptimizationProgress,
} from '@/features/route-optimization/api/optimizationApiTypes';
import {
  getOptimizationJobState,
  getOptimizationResult,
  cancelOptimizationJob,
  readResponseBody,
} from '@/features/route-optimization/api/optimizationHttp';
import {
  parseOptimizationJobEvent,
  parseOptimizationEventStream,
} from '@/features/route-optimization/api/optimizationEventStream';
import {
  createAbortError,
  readApiError,
  captureContractViolation,
} from '@/features/route-optimization/api/optimizationApiErrors';
export {
  RouteOptimizationApiError,
  type RouteOptimizationProgress,
  type RouteOptimizationFailure,
} from '@/features/route-optimization/api/optimizationApiTypes';

export async function optimizeDayRoute(
  request: TrouteOptimizeRequest,
  onProgress: (progress: RouteOptimizationProgress) => void,
  signal?: AbortSignal,
): Promise<TrouteOptimizeResponse> {
  const parsedRequest = trouteOptimizeRequestSchema.safeParse(request);
  if (!parsedRequest.success) {
    throw new RouteOptimizationApiError(
      L(
        'routeOptimization:routeOptimizationApi.error.routeOptimizationRequestDataIncorrect',
      ),
    );
  }

  const timeoutSignal = AbortSignal.timeout(
    ROUTE_OPTIMIZATION_API_CONFIG.requestTimeoutMs,
  );
  const requestSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;
  let requestDispatched = false;
  let submittedJobId: string | null = null;

  try {
    requestSignal.throwIfAborted();
    requestDispatched = true;
    const response = await fetch(withBillingMode(API_ROUTES.trouteOptimize), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...billingHeaders() },
      body: JSON.stringify(parsedRequest.data),
      signal: requestSignal,
    });
    const responseBody = await readResponseBody(response);
    notifyBillingChanged();
    if (!response.ok) {
      const error = new RouteOptimizationApiError(
        readBillingError(responseBody.body) ??
          readApiError(
            responseBody.body,
            L(
              'routeOptimization:routeOptimizationApi.error.optimizationRequestFailedHttp',
              { status: response.status },
            ),
            parsedRequest.data,
          ),
      );
      captureUnexpectedApiException(
        new Error('ROUTE_OPTIMIZATION_UNEXPECTED_HTTP_ERROR'),
        {
          operation: 'route-optimization.submit',
          httpStatus: response.status,
        },
      );
      throw error;
    }
    if (!responseBody.isJson) {
      throw captureContractViolation(
        'route-optimization.parse-submission',
        L(
          'routeOptimization:routeOptimizationApi.error.optimizationRequestResponseFormatIncorrect',
        ),
      );
    }

    const immediate = trouteOptimizeResponseSchema.safeParse(responseBody.body);
    if (immediate.success) {
      return immediate.data;
    }

    const submission = trouteJobSubmissionResponseSchema.safeParse(
      responseBody.body,
    );
    if (!submission.success) {
      throw captureContractViolation(
        'route-optimization.validate-submission',
        L(
          'routeOptimization:routeOptimizationApi.error.optimizationRequestResponseFormatIncorrect',
        ),
      );
    }
    if (submission.data.job_id !== parsedRequest.data.job_id) {
      throw captureContractViolation(
        'route-optimization.validate-job-id',
        L(
          'routeOptimization:routeOptimizationApi.error.optimizationJobIdDoesNotMatch',
        ),
      );
    }

    submittedJobId = submission.data.job_id;
    return await streamOptimizationJob(
      submittedJobId,
      onProgress,
      requestSignal,
    );
  } catch (cause) {
    if (requestSignal.aborted) {
      if (requestDispatched) {
        await cancelOptimizationJob(
          submittedJobId ?? parsedRequest.data.job_id,
        );
      }
      throw createAbortError(signal, timeoutSignal);
    }
    if (cause instanceof RouteOptimizationApiError) {
      throw cause;
    }
    throw new RouteOptimizationApiError(
      L(
        'routeOptimization:routeOptimizationApi.error.errorOccurredWhileCommunicatingTroute',
      ),
    );
  }
}

async function streamOptimizationJob(
  jobId: string,
  onProgress: (progress: RouteOptimizationProgress) => void,
  signal: AbortSignal,
): Promise<TrouteOptimizeResponse> {
  signal.throwIfAborted();
  const response = await fetch(
    `${API_ROUTES.trouteJobs}/${encodeURIComponent(jobId)}/events`,
    {
      headers: { Accept: 'text/event-stream' },
      signal,
    },
  );
  if (!response.ok) {
    const responseBody = await readResponseBody(response);
    const error = new RouteOptimizationApiError(
      readApiError(
        responseBody.body,
        L(
          'routeOptimization:routeOptimizationApi.error.optimizationProgressConnectionFailedHttp',
          { status: response.status },
        ),
      ),
    );
    captureUnexpectedApiException(
      new Error('ROUTE_OPTIMIZATION_UNEXPECTED_HTTP_ERROR'),
      {
        operation: 'route-optimization.stream',
        httpStatus: response.status,
      },
    );
    throw error;
  }
  if (
    response.body === null ||
    !response.headers
      .get('content-type')
      ?.toLowerCase()
      .startsWith('text/event-stream')
  ) {
    throw captureContractViolation(
      'route-optimization.validate-stream',
      L(
        'routeOptimization:routeOptimizationApi.error.optimizationProgressResponseFormatIncorrect',
      ),
    );
  }

  let terminalState: TrouteJobState | null = null;
  await parseOptimizationEventStream(response.body, (type, data) => {
    const state = parseOptimizationJobEvent(type, data, jobId);
    onProgress(state);
    if (
      state.status === 'completed' ||
      state.status === 'failed' ||
      state.status === 'cancelled'
    ) {
      terminalState = state;
    }
  });
  signal.throwIfAborted();

  if (terminalState === null) {
    terminalState = await getOptimizationJobState(jobId, signal);
    onProgress(terminalState);
  }
  return getOptimizationResult(terminalState);
}
