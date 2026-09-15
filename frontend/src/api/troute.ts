import {
  API_ROUTES,
  trouteOptimizeResponseSchema,
  type TrouteOptimizeRequest,
  type TrouteOptimizeResponse,
} from '@trasolve/shared';

const REQUEST_TIMEOUT_MS = 35_000;

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
