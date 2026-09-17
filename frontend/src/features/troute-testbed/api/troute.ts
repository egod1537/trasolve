import {
  API_ROUTES,
  apiErrorSchema,
  trouteJobCancelledEventSchema,
  trouteJobCompletedEventSchema,
  trouteJobFailedEventSchema,
  trouteJobHistoryResponseSchema,
  trouteJobIdSchema,
  trouteJobProgressEventSchema,
  trouteJobSnapshotEventSchema,
  trouteJobStateSchema,
  trouteJobSubmissionResponseSchema,
  trouteHealthResponseSchema,
  trouteOptimizeResponseSchema,
  trouteOptimizeRequestSchema,
  type TrouteJobHistoryItem,
  type TrouteJobState,
  type TrouteOptimizeRequest,
} from '@trasolve/shared';
import type {
  TrouteCancelGatewayResult,
  TrouteGatewayResult,
} from '@/entities/route-job';

const REQUEST_TIMEOUT_MS = 35_000;
const JOB_INSPECTION_TIMEOUT_MS = 5_000;

export type TrouteJobEventType =
  'snapshot' | 'progress' | 'completed' | 'failed' | 'cancelled';

export type ParsedTrouteJobEvent = {
  state: TrouteJobState;
  sequence?: number;
  updatedAt?: number;
};

export class TrouteNetworkError extends Error {
  public constructor(
    message: string,
    public readonly durationMs: number,
    public readonly requestBody: string,
  ) {
    super(message);
    this.name = 'TrouteNetworkError';
  }
}

export class TrouteCancelNetworkError extends Error {
  public constructor(
    message: string,
    public readonly durationMs: number,
  ) {
    super(message);
    this.name = 'TrouteCancelNetworkError';
  }
}

export async function checkTrouteHealth(
  signal?: AbortSignal,
): Promise<boolean> {
  const response = await fetch(API_ROUTES.trouteInternalHealth, { signal });
  if (!response.ok) {
    return false;
  }
  return trouteHealthResponseSchema.safeParse(await response.json()).success;
}

export function getTrouteCancelPath(jobId: string): string {
  const parsedJobId = trouteJobIdSchema.parse(jobId);
  return `${API_ROUTES.trouteInternalJobs}/${encodeURIComponent(parsedJobId)}/cancel`;
}

export function getTrouteJobEventPath(jobId: string): string {
  const parsedJobId = trouteJobIdSchema.parse(jobId);
  return `${API_ROUTES.trouteInternalJobs}/${encodeURIComponent(parsedJobId)}/events`;
}

export function parseTrouteJobEvent(
  type: TrouteJobEventType,
  data: string,
): ParsedTrouteJobEvent {
  let body: unknown;
  try {
    body = JSON.parse(data) as unknown;
  } catch {
    throw new Error('troute Job SSE data가 JSON 형식이 아닙니다.');
  }

  const envelope = getEventSchema(type).safeParse(body);
  if (envelope.success) {
    return {
      state: envelope.data.state,
      ...(envelope.data.sequence === undefined
        ? {}
        : { sequence: envelope.data.sequence }),
      ...(envelope.data.updated_at === undefined
        ? {}
        : { updatedAt: envelope.data.updated_at }),
    };
  }

  const rawState = trouteJobStateSchema.safeParse(body);
  if (rawState.success && eventMatchesState(type, rawState.data)) {
    return { state: rawState.data };
  }
  throw new Error(`troute Job ${type} SSE data 형식이 올바르지 않습니다.`);
}

export async function cancelTrouteJob(
  jobId: string,
  signal?: AbortSignal,
): Promise<TrouteCancelGatewayResult> {
  const timeout = AbortSignal.timeout(JOB_INSPECTION_TIMEOUT_MS);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const startedAt = performance.now();

  let response: Response;
  let rawResponse: string;
  try {
    response = await fetch(getTrouteCancelPath(jobId), {
      method: 'POST',
      signal: requestSignal,
    });
    rawResponse = await response.text();
  } catch {
    throw new TrouteCancelNetworkError(
      timeout.aborted
        ? 'Job 강제 종료 응답 대기 시간이 초과됐습니다.'
        : 'Job 강제 종료를 위해 Trasolve backend에 연결할 수 없습니다.',
      performance.now() - startedAt,
    );
  }

  const responseBody = parseResponseBody(rawResponse);
  const parsedState = response.ok
    ? trouteJobStateSchema.safeParse(responseBody)
    : null;
  const parsedError = response.ok
    ? null
    : apiErrorSchema.safeParse(responseBody);
  return {
    httpStatus: response.status,
    statusText: response.statusText,
    durationMs: performance.now() - startedAt,
    rawResponse,
    responseBody,
    errorResponse: parsedError?.success ? parsedError.data : null,
    jobState: parsedState?.success ? parsedState.data : null,
  };
}

export async function getTrouteJob(
  jobId: string,
  signal?: AbortSignal,
): Promise<TrouteJobState> {
  const parsedJobId = trouteJobIdSchema.parse(jobId);
  const timeout = AbortSignal.timeout(JOB_INSPECTION_TIMEOUT_MS);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const response = await fetch(
    `${API_ROUTES.trouteInternalJobs}/${encodeURIComponent(parsedJobId)}`,
    { signal: requestSignal },
  );
  if (!response.ok) {
    throw new Error(
      `troute job 조회가 HTTP ${response.status}로 실패했습니다.`,
    );
  }

  const parsed = trouteJobStateSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error('troute job 조회 응답 형식이 올바르지 않습니다.');
  }
  return parsed.data;
}

export async function listTrouteJobs(
  limit = 50,
  signal?: AbortSignal,
): Promise<TrouteJobHistoryItem[]> {
  const timeout = AbortSignal.timeout(JOB_INSPECTION_TIMEOUT_MS);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const query = new URLSearchParams({ limit: String(limit) });
  const response = await fetch(
    `${API_ROUTES.trouteInternalJobs}?${query.toString()}`,
    { signal: requestSignal },
  );
  if (!response.ok) {
    throw new Error(
      `troute Job 목록 조회가 HTTP ${response.status}로 실패했습니다.`,
    );
  }

  const parsed = trouteJobHistoryResponseSchema.safeParse(
    await response.json(),
  );
  if (!parsed.success) {
    throw new Error('troute Job 목록 응답 형식이 올바르지 않습니다.');
  }
  return parsed.data.jobs;
}

export async function optimizeRouteWithTroute(
  request: TrouteOptimizeRequest,
  signal?: AbortSignal,
): Promise<TrouteGatewayResult> {
  const requestBody = JSON.stringify(
    trouteOptimizeRequestSchema.parse(request),
  );
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const startedAt = performance.now();

  let response: Response;
  let rawResponse: string;
  try {
    response = await fetch(API_ROUTES.trouteOptimize, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody,
      signal: requestSignal,
    });
    rawResponse = await response.text();
  } catch {
    const durationMs = performance.now() - startedAt;
    throw new TrouteNetworkError(
      timeout.aborted
        ? 'Trasolve backend 응답 대기 시간이 초과됐습니다.'
        : 'Trasolve backend에 연결할 수 없습니다.',
      durationMs,
      requestBody,
    );
  }

  const durationMs = performance.now() - startedAt;
  const responseBody = parseResponseBody(rawResponse);
  const parsed = response.ok
    ? trouteOptimizeResponseSchema.safeParse(responseBody)
    : null;
  const parsedSubmission = response.ok
    ? trouteJobSubmissionResponseSchema.safeParse(responseBody)
    : null;
  const acceptedJobId =
    parsedSubmission?.success && parsedSubmission.data.job_id === request.job_id
      ? parsedSubmission.data.job_id
      : null;
  const parsedError = response.ok
    ? null
    : apiErrorSchema.safeParse(responseBody);

  return {
    httpStatus: response.status,
    statusText: response.statusText,
    durationMs,
    requestBody,
    rawResponse,
    responseBody,
    errorResponse: parsedError?.success ? parsedError.data : null,
    acceptedJobId,
    optimization: parsed?.success ? parsed.data : null,
    responseValidationError:
      parsedSubmission?.success && acceptedJobId === null
        ? '응답 job_id가 요청 job_id와 일치하지 않습니다.'
        : parsed && !parsed.success && !parsedSubmission?.success
          ? parsed.error.issues
              .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
              .join('; ')
          : null,
  };
}

function getEventSchema(type: TrouteJobEventType) {
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

function parseResponseBody(rawResponse: string): unknown {
  if (!rawResponse) {
    return null;
  }
  try {
    return JSON.parse(rawResponse) as unknown;
  } catch {
    return rawResponse;
  }
}
