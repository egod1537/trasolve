import {
  API_ROUTES,
  apiErrorSchema,
  trouteJobStateSchema,
  trouteJobSubmissionResponseSchema,
  trouteOptimizeRequestSchema,
  trouteOptimizeResponseSchema,
  type TrouteJobState,
  type TrouteOptimizeRequest,
  type TrouteOptimizeResponse,
} from '@trasolve/shared';

const ROUTE_OPTIMIZATION_API_CONFIG = {
  pollIntervalMs: 400,
  requestTimeoutMs: 120_000,
  cancelTimeoutMs: 5_000,
} as const;

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
    onProgress({
      status: 'pending',
      stage: null,
      progress: 0,
      last_message: null,
    });
    return await pollOptimizationJob(submittedJobId, onProgress, requestSignal);
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

async function pollOptimizationJob(
  jobId: string,
  onProgress: (progress: RouteOptimizationProgress) => void,
  signal: AbortSignal,
): Promise<TrouteOptimizeResponse> {
  while (true) {
    signal.throwIfAborted();
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
    if (!responseBody.isJson) {
      throw new RouteOptimizationApiError(
        '최적화 상태 응답 형식이 올바르지 않습니다.',
      );
    }

    const parsed = trouteJobStateSchema.safeParse(responseBody.body);
    if (!parsed.success || parsed.data.job_id !== jobId) {
      throw new RouteOptimizationApiError(
        '최적화 상태 응답 형식이 올바르지 않습니다.',
      );
    }

    const state = parsed.data;
    onProgress(state);
    if (state.status === 'completed') {
      if (state.result) {
        return state.result;
      }
      throw new RouteOptimizationApiError(
        '완료된 최적화 Job에 결과가 없습니다.',
      );
    }
    if (state.status === 'failed') {
      throw new RouteOptimizationApiError(
        formatOptimizationJobError(state.error),
      );
    }
    if (state.status === 'cancelled') {
      throw new RouteOptimizationApiError('경로 최적화가 취소되었습니다.');
    }
    await waitForPoll(signal);
  }
}

function formatOptimizationJobError(error: TrouteJobState['error']): string {
  if (!error) {
    return '경로 최적화에 실패했습니다.';
  }

  if (error.code === 'NO_FEASIBLE_ROUTE') {
    return '현재 영업시간과 체류시간 조건으로 가능한 경로를 찾지 못했습니다.';
  }

  if (error.code === 'ROUTING_UNAVAILABLE') {
    const detail = error.detail?.toLowerCase() ?? '';
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

function waitForPoll(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const complete = (): void => {
      signal.removeEventListener('abort', abort);
      resolve();
    };
    const abort = (): void => {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      reject(signal.reason);
    };
    const timeout = setTimeout(
      complete,
      ROUTE_OPTIMIZATION_API_CONFIG.pollIntervalMs,
    );
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      abort();
    }
  });
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

function readApiError(body: unknown, fallback: string): string {
  const parsed = apiErrorSchema.safeParse(body);
  return parsed.success ? parsed.data.error.message : fallback;
}
