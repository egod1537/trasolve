import {
  API_ROUTES,
  apiErrorSchema,
  trouteJobCancelledEventSchema,
  trouteJobCompletedEventSchema,
  trouteJobFailedEventSchema,
  trouteJobProgressEventSchema,
  trouteJobSnapshotEventSchema,
  trouteJobStateSchema,
  trouteJobSubmissionResponseSchema,
  trouteOptimizeRequestSchema,
  trouteOptimizeResponseSchema,
  type TrouteJobState,
  type TrouteOptimizeRequest,
  type TrouteOptimizeResponse,
} from '@trasolve/shared';
import { L } from '@/shared/i18n';
import { captureUnexpectedApiException } from '@/shared/observability/sentry';

const ROUTE_OPTIMIZATION_API_CONFIG = {
  requestTimeoutMs: 120_000,
  cancelTimeoutMs: 5_000,
} as const;

type TrouteJobEventType =
  'snapshot' | 'progress' | 'completed' | 'failed' | 'cancelled';

type ParsedResponseBody = {
  body: unknown;
  isJson: boolean;
};

class RouteOptimizationApiError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'RouteOptimizationApiError';
  }
}

export type RouteOptimizationProgress = Pick<
  TrouteJobState,
  'status' | 'stage' | 'progress' | 'last_message'
>;

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
    const response = await fetch(API_ROUTES.trouteOptimize, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsedRequest.data),
      signal: requestSignal,
    });
    const responseBody = await readResponseBody(response);
    if (!response.ok) {
      const error = new RouteOptimizationApiError(
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
    `${API_ROUTES.trouteInternalJobs}/${encodeURIComponent(jobId)}/events`,
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

async function getOptimizationJobState(
  jobId: string,
  signal: AbortSignal,
): Promise<TrouteJobState> {
  const response = await fetch(
    `${API_ROUTES.trouteInternalJobs}/${encodeURIComponent(jobId)}`,
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

function getOptimizationResult(state: TrouteJobState): TrouteOptimizeResponse {
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

function parseOptimizationJobEvent(
  type: TrouteJobEventType,
  data: string,
  jobId: string,
): TrouteJobState {
  let body: unknown;
  try {
    body = JSON.parse(data) as unknown;
  } catch {
    throw captureContractViolation(
      'route-optimization.parse-event',
      L(
        'routeOptimization:routeOptimizationApi.error.optimizationProgressDataNotJsonFormat',
      ),
    );
  }
  const envelope = getOptimizationEventSchema(type).safeParse(body);
  const parsedRawState = trouteJobStateSchema.safeParse(body);
  const rawState = envelope.success
    ? envelope.data.state
    : parsedRawState.success
      ? parsedRawState.data
      : null;
  if (
    !rawState ||
    rawState.job_id !== jobId ||
    (!envelope.success && !eventMatchesState(type, rawState))
  ) {
    throw captureContractViolation(
      'route-optimization.validate-event',
      L(
        'routeOptimization:routeOptimizationApi.error.optimizationProgressDataFormatIncorrect',
      ),
    );
  }
  return rawState;
}

function eventMatchesState(
  type: TrouteJobEventType,
  state: TrouteJobState,
): boolean {
  switch (type) {
    case 'snapshot':
      return true;
    case 'progress':
      return state.status === 'pending' || state.status === 'running';
    case 'completed':
      return state.status === 'completed' && state.result !== null;
    case 'failed':
      return state.status === 'failed' && state.error !== null;
    case 'cancelled':
      return state.status === 'cancelled';
  }
}

function getOptimizationEventSchema(type: TrouteJobEventType) {
  switch (type) {
    case 'snapshot':
      return trouteJobSnapshotEventSchema;
    case 'progress':
      return trouteJobProgressEventSchema;
    case 'completed':
      return trouteJobCompletedEventSchema;
    case 'failed':
      return trouteJobFailedEventSchema;
    case 'cancelled':
      return trouteJobCancelledEventSchema;
  }
}

async function parseOptimizationEventStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (type: TrouteJobEventType, data: string) => void,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = '';
  let eventType = '';
  let dataLines: string[] = [];

  const dispatch = (): void => {
    if (dataLines.length > 0 && isTrouteJobEventType(eventType)) {
      onEvent(eventType, dataLines.join('\n'));
    }
    eventType = '';
    dataLines = [];
  };
  const consumeLine = (line: string): void => {
    if (line === '') {
      dispatch();
      return;
    }
    if (line.startsWith(':')) {
      return;
    }
    const separator = line.indexOf(':');
    const field = separator < 0 ? line : line.slice(0, separator);
    let value = separator < 0 ? '' : line.slice(separator + 1);
    if (value.startsWith(' ')) {
      value = value.slice(1);
    }
    if (field === 'event') {
      eventType = value;
    } else if (field === 'data') {
      dataLines.push(value);
    }
  };

  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split(/\r\n|\r|\n/);
    buffer = lines.pop() ?? '';
    lines.forEach(consumeLine);
  }
  buffer += decoder.decode();
  if (buffer) {
    consumeLine(buffer);
  }
  dispatch();
}

function isTrouteJobEventType(value: string): value is TrouteJobEventType {
  return (
    value === 'snapshot' ||
    value === 'progress' ||
    value === 'completed' ||
    value === 'failed' ||
    value === 'cancelled'
  );
}

function formatOptimizationJobError(error: TrouteJobState['error']): string {
  if (!error) {
    return L(
      'routeOptimization:routeOptimizationApi.formatOptimizationJobError.text.pathOptimizationFailed',
    );
  }

  if (
    error.code === 'NO_FEASIBLE_ROUTE' ||
    error.code === 'NO_FEASIBLE_SCHEDULE'
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

async function cancelOptimizationJob(jobId: string): Promise<void> {
  try {
    await fetch(
      `${API_ROUTES.trouteInternalJobs}/${encodeURIComponent(jobId)}/cancel`,
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

async function readResponseBody(
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

function createAbortError(
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

function readApiError(
  body: unknown,
  fallback: string,
  request?: TrouteOptimizeRequest,
): string {
  const parsed = apiErrorSchema.safeParse(body);
  if (!parsed.success) {
    return fallback;
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

function captureContractViolation(
  operation: string,
  message: string,
): RouteOptimizationApiError {
  const error = new RouteOptimizationApiError(message);
  captureUnexpectedApiException(error, { operation });
  return error;
}

function isProviderConfigurationError(code: string): boolean {
  return (
    code === 'PROVIDER_NOT_CONFIGURED' ||
    code === 'ROUTING_PROVIDER_NOT_CONFIGURED' ||
    code === 'ROUTING_CONFIGURATION_ERROR'
  );
}

function isInvalidTimeWindowError(code: string): boolean {
  return (
    code === 'INVALID_TIME_WINDOW' ||
    code === 'TIME_WINDOW_INVALID' ||
    code === 'INVALID_SCHEDULE_WINDOW'
  );
}

function formatStartPolicy(
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
