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
import { L } from '@/shared/i18n';
import { captureUnexpectedApiException } from '@/shared/observability/sentry';

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
    throw trouteContractViolation(
      'troute.parse-job-event',
      L('testbed:trouteTestbed.text.unknownErrorOccurredDuringTrasolveBackend'),
    );
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
  throw trouteContractViolation(
    'troute.validate-job-event',
    L('testbed:trouteTestbed.text.unknownErrorOccurredDuringTrasolveBackend'),
  );
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
        ? L('testbed:trouteTestbed.text.unknownErrorOccurredWhileForcingJob')
        : L('testbed:trouteTestbed.text.unknownErrorOccurredWhileForcingJob'),
      performance.now() - startedAt,
    );
  }

  const responseBody = parseResponseBody(rawResponse);
  if (!response.ok) {
    captureUnexpectedApiException(
      new Error(
        L('testbed:trouteTestbed.text.unknownErrorOccurredWhileForcingJob'),
      ),
      {
        operation: 'troute.cancel-job',
        httpStatus: response.status,
      },
    );
  }
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
    const error = new Error(
      L('testbed:trouteTestbed.text.unknownErrorOccurredDuringTrasolveBackend'),
    );
    captureUnexpectedApiException(error, {
      operation: 'troute.get-job',
      httpStatus: response.status,
    });
    throw error;
  }

  const parsed = trouteJobStateSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw trouteContractViolation(
      'troute.validate-job',
      L('testbed:trouteTestbed.text.unknownErrorOccurredDuringTrasolveBackend'),
    );
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
    const error = new Error(
      L('testbed:trouteTestbed.text.unknownErrorOccurredDuringTrasolveBackend'),
    );
    captureUnexpectedApiException(error, {
      operation: 'troute.list-jobs',
      httpStatus: response.status,
    });
    throw error;
  }

  const parsed = trouteJobHistoryResponseSchema.safeParse(
    await response.json(),
  );
  if (!parsed.success) {
    throw trouteContractViolation(
      'troute.validate-job-list',
      L('testbed:trouteTestbed.text.unknownErrorOccurredDuringTrasolveBackend'),
    );
  }
  return parsed.data.jobs;
}

export async function optimizeRouteWithTroute(
  request: TrouteOptimizeRequest,
  signal?: AbortSignal,
): Promise<TrouteGatewayResult> {
  const requestBody = createTrouteOptimizeRequestBody(request);
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
        ? L(
            'testbed:trouteTestbed.text.unknownErrorOccurredDuringTrasolveBackend',
          )
        : L(
            'testbed:trouteTestbed.text.unknownErrorOccurredDuringTrasolveBackend',
          ),
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
  const responseValidationError =
    parsedSubmission?.success && acceptedJobId === null
      ? L(
          'testbed:troute.optimizeRouteWithTroute.text.responseJobIdDoesNotMatch',
        )
      : parsed && !parsed.success && !parsedSubmission?.success
        ? parsed.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ')
        : null;
  if (!response.ok) {
    captureUnexpectedApiException(
      new Error(
        L(
          'testbed:trouteTestbed.text.unknownErrorOccurredDuringTrasolveBackend',
        ),
      ),
      {
        operation: 'troute.optimize',
        httpStatus: response.status,
      },
    );
  } else if (responseValidationError) {
    captureUnexpectedApiException(
      new Error('TROUTE_RESPONSE_CONTRACT_VIOLATION'),
      {
        operation: 'troute.validate-optimization-response',
      },
    );
  }

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
    responseValidationError,
  };
}

export function createTrouteOptimizeRequestBody(
  request: TrouteOptimizeRequest,
): string {
  return JSON.stringify(trouteOptimizeRequestSchema.parse(request));
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

function trouteContractViolation(operation: string, message: string): Error {
  const error = new Error(message);
  captureUnexpectedApiException(error, { operation });
  return error;
}
