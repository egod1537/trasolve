import {
  API_ROUTES,
  trouteJobHistoryResponseSchema,
  trouteJobStateSchema,
  trouteOptimizeResponseSchema,
  type TrouteJobHistoryItem,
  type TrouteJobState,
  type TrouteOptimizeRequest,
  type TrouteOptimizeResponse,
} from '@trasolve/shared';

const REQUEST_TIMEOUT_MS = 35_000;
const JOB_INSPECTION_TIMEOUT_MS = 5_000;

export type TrouteGatewayResult = {
  httpStatus: number;
  statusText: string;
  durationMs: number;
  requestBody: string;
  rawResponse: string;
  responseBody: unknown;
  optimization: TrouteOptimizeResponse | null;
  responseValidationError: string | null;
};

export type TrouteCancelGatewayResult = {
  httpStatus: number;
  statusText: string;
  durationMs: number;
  rawResponse: string;
  responseBody: unknown;
  jobState: TrouteJobState | null;
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
  const body = (await response.json()) as unknown;
  return (
    typeof body === 'object' &&
    body !== null &&
    'status' in body &&
    body.status === 'ok' &&
    'service' in body &&
    body.service === 'troute'
  );
}

export function getTrouteCancelPath(jobId: string): string {
  return `${API_ROUTES.trouteInternalJobs}/${encodeURIComponent(jobId)}/cancel`;
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
  return {
    httpStatus: response.status,
    statusText: response.statusText,
    durationMs: performance.now() - startedAt,
    rawResponse,
    responseBody,
    jobState: parsedState?.success ? parsedState.data : null,
  };
}

export async function getTrouteJob(
  jobId: string,
  signal?: AbortSignal,
): Promise<TrouteJobState> {
  const timeout = AbortSignal.timeout(JOB_INSPECTION_TIMEOUT_MS);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const response = await fetch(
    `${API_ROUTES.trouteInternalJobs}/${encodeURIComponent(jobId)}`,
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
  const requestBody = JSON.stringify(request);
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

  return {
    httpStatus: response.status,
    statusText: response.statusText,
    durationMs,
    requestBody,
    rawResponse,
    responseBody,
    optimization: parsed?.success ? parsed.data : null,
    responseValidationError:
      parsed && !parsed.success
        ? parsed.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ')
        : null,
  };
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
