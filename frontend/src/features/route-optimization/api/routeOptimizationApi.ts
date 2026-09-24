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
      '경로 최적화 요청 데이터가 올바르지 않습니다.',
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
      throw new RouteOptimizationApiError(
        readApiError(
          responseBody.body,
          `최적화 요청이 HTTP ${response.status}로 실패했습니다.`,
          parsedRequest.data,
        ),
      );
    }
    if (!responseBody.isJson) {
      throw new RouteOptimizationApiError(
        '최적화 요청 응답 형식이 올바르지 않습니다.',
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
      throw new RouteOptimizationApiError(
        '최적화 요청 응답 형식이 올바르지 않습니다.',
      );
    }
    if (submission.data.job_id !== parsedRequest.data.job_id) {
      throw new RouteOptimizationApiError(
        '최적화 Job ID가 요청과 일치하지 않습니다.',
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
      'troute와 통신하는 중 오류가 발생했습니다.',
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
    throw new RouteOptimizationApiError(
      readApiError(
        responseBody.body,
        `최적화 진행 상태 연결이 HTTP ${response.status}로 실패했습니다.`,
      ),
    );
  }
  if (
    response.body === null ||
    !response.headers
      .get('content-type')
      ?.toLowerCase()
      .startsWith('text/event-stream')
  ) {
    throw new RouteOptimizationApiError(
      '최적화 진행 상태 응답 형식이 올바르지 않습니다.',
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
    throw new RouteOptimizationApiError(
      readApiError(
        responseBody.body,
        `최적화 상태 조회가 HTTP ${response.status}로 실패했습니다.`,
      ),
    );
  }
  const parsed = trouteJobStateSchema.safeParse(responseBody.body);
  if (!responseBody.isJson || !parsed.success || parsed.data.job_id !== jobId) {
    throw new RouteOptimizationApiError(
      '최적화 상태 응답 형식이 올바르지 않습니다.',
    );
  }
  return parsed.data;
}

function getOptimizationResult(state: TrouteJobState): TrouteOptimizeResponse {
  if (state.status === 'completed') {
    if (state.result) {
      return state.result;
    }
    throw new RouteOptimizationApiError('완료된 최적화 Job에 결과가 없습니다.');
  }
  if (state.status === 'failed') {
    throw new RouteOptimizationApiError(
      formatOptimizationJobError(state.error),
    );
  }
  if (state.status === 'cancelled') {
    throw new RouteOptimizationApiError('경로 최적화가 취소되었습니다.');
  }
  throw new RouteOptimizationApiError(
    '최적화 진행 상태 연결이 결과 없이 종료되었습니다.',
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
    throw new RouteOptimizationApiError(
      '최적화 진행 상태 데이터가 JSON 형식이 아닙니다.',
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
    throw new RouteOptimizationApiError(
      '최적화 진행 상태 데이터 형식이 올바르지 않습니다.',
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
    return '경로 최적화에 실패했습니다.';
  }

  if (
    error.code === 'NO_FEASIBLE_ROUTE' ||
    error.code === 'NO_FEASIBLE_SCHEDULE'
  ) {
    return '현재 영업시간과 체류시간 조건으로 가능한 경로를 찾지 못했습니다.';
  }

  if (isProviderConfigurationError(error.code)) {
    return '경로 조회 제공자가 설정되어 있지 않습니다. 서버 설정을 확인해 주세요.';
  }

  if (isInvalidTimeWindowError(error.code)) {
    return '장소 영업시간 또는 방문시간 범위가 올바르지 않습니다.';
  }

  const detail = error.detail?.toLowerCase() ?? '';
  if (
    error.code === 'INVALID_REQUEST' &&
    (detail.includes('time window') || detail.includes('open_time'))
  ) {
    return '장소 영업시간 또는 방문시간 범위가 올바르지 않습니다.';
  }

  if (error.code === 'ROUTING_UNAVAILABLE') {
    if (
      detail.includes('provider') &&
      (detail.includes('not configured') ||
        detail.includes('configuration') ||
        detail.includes('api key'))
    ) {
      return '경로 조회 제공자가 설정되어 있지 않습니다. 서버 설정을 확인해 주세요.';
    }
    if (
      detail.includes('place id') &&
      (detail.includes('invalid') || detail.includes('not found'))
    ) {
      return '유효하지 않은 Place ID가 있어 이동 경로를 조회하지 못했습니다.';
    }
    if (
      detail.includes('tcache') &&
      (detail.includes('connection') ||
        detail.includes('refused') ||
        detail.includes('unavailable') ||
        detail.includes('failed to fetch'))
    ) {
      return 'tcache 서버에 연결할 수 없어 이동시간을 조회하지 못했습니다.';
    }
    if (detail.includes('google_routes_error')) {
      return 'Google Routes가 해당 장소와 이동수단의 경로를 반환하지 않았습니다.';
    }
    return 'tcache 또는 Google Routes에서 이동시간을 조회하지 못했습니다.';
  }

  if (error.code.includes('TIMEOUT')) {
    return '경로 최적화 처리 시간이 초과됐습니다.';
  }

  return error.message;
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
      `경로 최적화 요청 시간이 ${ROUTE_OPTIMIZATION_API_CONFIG.requestTimeoutMs / 1_000}초를 초과했습니다.`,
    );
  }
  return new RouteOptimizationApiError('경로 최적화 요청이 취소되었습니다.');
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
    return '경로 최적화 서버가 설정되어 있지 않습니다.';
  }
  if (code === 'TROUTE_UNAVAILABLE') {
    return '경로 최적화 서버에 연결할 수 없습니다.';
  }
  if (code === 'TROUTE_TIMEOUT') {
    return '경로 최적화 요청 시간이 초과됐습니다.';
  }
  if (code === 'TROUTE_START_POLICY_UNSUPPORTED') {
    return `${formatStartPolicy(request?.start_policy)} 시작 방식은 현재 troute 서버에서 지원하지 않습니다.`;
  }
  if (isInvalidTimeWindowError(code)) {
    return '장소 영업시간 또는 방문시간 범위가 올바르지 않습니다.';
  }
  return message;
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
      return '지정 시각';
    case 'EARLIEST':
      return '최대한 이르게';
    case 'LATEST':
      return '최대한 늦게';
    default:
      return '선택한';
  }
}
