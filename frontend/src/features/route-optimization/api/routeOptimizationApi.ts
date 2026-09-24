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

const POLL_INTERVAL_MS = 400;
const REQUEST_TIMEOUT_MS = 120_000;

export type RouteOptimizationProgress = Pick<
  TrouteJobState,
  'status' | 'stage' | 'progress' | 'last_message'
>;

export async function optimizeDayRoute(
  request: TrouteOptimizeRequest,
  onProgress: (progress: RouteOptimizationProgress) => void,
  signal?: AbortSignal,
): Promise<TrouteOptimizeResponse> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const response = await fetch(API_ROUTES.trouteOptimize, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trouteOptimizeRequestSchema.parse(request)),
    signal: requestSignal,
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    throw new Error(
      readApiError(
        body,
        `최적화 요청이 HTTP ${response.status}로 실패했습니다.`,
      ),
    );
  }
  const immediate = trouteOptimizeResponseSchema.safeParse(body);
  if (immediate.success) {
    return immediate.data;
  }
  const submission = trouteJobSubmissionResponseSchema.safeParse(body);
  if (!submission.success) {
    throw new Error('최적화 요청 응답 형식이 올바르지 않습니다.');
  }
  return pollOptimizationJob(submission.data.job_id, onProgress, requestSignal);
}

async function pollOptimizationJob(
  jobId: string,
  onProgress: (progress: RouteOptimizationProgress) => void,
  signal: AbortSignal,
): Promise<TrouteOptimizeResponse> {
  while (!signal.aborted) {
    const response = await fetch(
      `${API_ROUTES.trouteInternalJobs}/${encodeURIComponent(jobId)}`,
      { signal },
    );
    const body: unknown = await response.json();
    if (!response.ok) {
      throw new Error(
        readApiError(
          body,
          `최적화 상태 조회가 HTTP ${response.status}로 실패했습니다.`,
        ),
      );
    }
    const parsed = trouteJobStateSchema.safeParse(body);
    if (!parsed.success) {
      throw new Error('최적화 상태 응답 형식이 올바르지 않습니다.');
    }
    const state = parsed.data;
    onProgress(state);
    if (state.status === 'completed' && state.result) {
      return state.result;
    }
    if (state.status === 'failed') {
      throw new Error(state.error?.message ?? '경로 최적화에 실패했습니다.');
    }
    if (state.status === 'cancelled') {
      throw new Error('경로 최적화가 취소되었습니다.');
    }
    await waitForPoll(signal);
  }
  throw signal.reason instanceof Error
    ? signal.reason
    : new Error('경로 최적화가 중단되었습니다.');
}

function waitForPoll(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(resolve, POLL_INTERVAL_MS);
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timeout);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

function readApiError(body: unknown, fallback: string): string {
  const parsed = apiErrorSchema.safeParse(body);
  return parsed.success ? parsed.data.error.message : fallback;
}
