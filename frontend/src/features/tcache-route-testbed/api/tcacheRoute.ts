import { API_ROUTES } from '@trasolve/shared';
import {
  cancelTcacheRouteJob as requestCancelTcacheRouteJob,
  checkTcacheHealth,
  createTcacheRouteJob as requestCreateTcacheRouteJob,
  getTcacheRouteJob as requestTcacheRouteJob,
  getTcacheRouteJobEventsPath,
  getTcacheRouteJobPath as getApiTcacheRouteJobPath,
  getTcacheRouteJobResult as requestTcacheRouteJobResult,
  listTcacheRouteJobs as requestTcacheRouteJobs,
  subscribeTcacheRouteJobEvents,
  type TcacheRouteCreateRequest,
  type TcacheRouteCreateLocation,
  type TcacheRouteSubscriptionOptions,
} from '@/api/tcache';
import type {
  TcacheRouteJob,
  TcacheRouteRequest,
  TcacheRouteResult,
} from '@/features/tcache-route-testbed/model/types';
import { L } from '@/shared/i18n';
import { captureUnexpectedApiException } from '@/shared/observability/sentry';
import { parseJob } from '@/features/tcache-route-testbed/api/tcacheJobMapping';
import { parseResult } from '@/features/tcache-route-testbed/api/tcacheResultMapping';
import {
  readString,
  readOptionalString,
  isRecord,
  tcacheContractViolation,
} from '@/features/tcache-route-testbed/api/tcacheContract';

export const TCACHE_ROUTE_API = {
  health: API_ROUTES.tcacheInternalHealth,
  jobs: API_ROUTES.tcacheInternalJobs,
} as const;

export async function checkTcacheRouteHealth(
  signal?: AbortSignal,
): Promise<boolean> {
  return checkTcacheHealth(signal);
}

export async function listTcacheRouteJobs(
  signal?: AbortSignal,
): Promise<TcacheRouteJob[]> {
  const body = await requestTcacheRouteJobs(signal);
  const source = Array.isArray(body)
    ? body
    : isRecord(body) && Array.isArray(body.jobs)
      ? body.jobs
      : null;
  if (!source) {
    throw tcacheContractViolation(
      'tcache.validate-job-list',
      L('testbed:tcacheRouteTestbed.errorMessage.text.unknownErrorOccurred'),
    );
  }
  return source.map(parseJob);
}

export async function getTcacheRouteJob(
  jobId: string,
  signal?: AbortSignal,
): Promise<TcacheRouteJob> {
  const body = await requestTcacheRouteJob(jobId, signal);
  return parseJob(unwrapJob(body));
}

export async function createTcacheRouteJob(
  request: TcacheRouteRequest,
  signal?: AbortSignal,
): Promise<TcacheRouteJob> {
  const createRequest = toTcacheRouteCreateRequest(request);
  const response = await requestCreateTcacheRouteJob(createRequest, signal);
  const body = response.body;
  const responseAt = Date.now();
  const startedAt = responseAt - response.durationMs;
  const pairId = crypto.randomUUID();
  const value = unwrapJob(body);
  let job: TcacheRouteJob;
  if (isRecord(value) && value.status !== undefined) {
    job = parseJob(value);
  } else {
    const jobId = isRecord(value)
      ? readString(value, ['job_id', 'jobId', 'id'])
      : '';
    if (!jobId) {
      throw tcacheContractViolation(
        'tcache.validate-created-job',
        L('testbed:tcacheRouteTestbed.errorMessage.text.unknownErrorOccurred'),
      );
    }
    job = {
      id: jobId,
      status: 'queued',
      createdAt: responseAt,
      updatedAt: responseAt,
      stage: 'queued',
      progress: 0,
      request,
      timeline: [],
      ...readJobUrls(isRecord(value) ? value : {}),
    };
  }
  return {
    ...job,
    request,
    timeline: [
      ...job.timeline,
      {
        id: crypto.randomUUID(),
        pairId,
        timestamp: startedAt,
        direction: 'REQUEST',
        source: 'testbed',
        target: 'trasolve',
        method: 'POST',
        label: 'POST',
        path: TCACHE_ROUTE_API.jobs,
        body: createRequest,
      },
      {
        id: crypto.randomUUID(),
        pairId,
        timestamp: responseAt,
        direction: 'RESPONSE',
        source: 'trasolve',
        target: 'testbed',
        method: 'POST',
        label: 'POST',
        path: TCACHE_ROUTE_API.jobs,
        status: response.httpStatus,
        latencyMs: response.durationMs,
        body,
      },
    ],
  };
}

export function toTcacheRouteCreateRequest(
  request: TcacheRouteRequest,
): TcacheRouteCreateRequest {
  return {
    mode: request.mode,
    locations: request.locations.map(toCreateLocation),
    departureTime: request.departureTime,
    ...(request.computeAlternativeRoutes === undefined
      ? {}
      : { computeAlternativeRoutes: request.computeAlternativeRoutes }),
    ...(request.languageCode ? { languageCode: request.languageCode } : {}),
    ...(request.regionCode ? { regionCode: request.regionCode } : {}),
    ...(request.countryCode ? { countryCode: request.countryCode } : {}),
    ...(request.provider ? { provider: request.provider } : {}),
    ...(request.routingPreference
      ? { routingPreference: request.routingPreference }
      : {}),
    ...(request.units ? { units: request.units } : {}),
  };
}

function readJobUrls(
  value: Record<string, unknown>,
): Pick<TcacheRouteJob, 'eventsUrl' | 'statusUrl' | 'resultUrl'> {
  const eventsUrl = readOptionalString(value, ['events_url', 'eventsUrl']);
  const statusUrl = readOptionalString(value, ['status_url', 'statusUrl']);
  const resultUrl = readOptionalString(value, ['result_url', 'resultUrl']);
  return {
    ...(eventsUrl ? { eventsUrl } : {}),
    ...(statusUrl ? { statusUrl } : {}),
    ...(resultUrl ? { resultUrl } : {}),
  };
}

export async function cancelTcacheRouteJob(
  jobId: string,
  signal?: AbortSignal,
): Promise<TcacheRouteJob> {
  const path = `${getTcacheRouteJobPath(jobId)}/cancel`;
  const response = await requestCancelTcacheRouteJob(jobId, signal);
  const body = response.body;
  const responseAt = Date.now();
  const startedAt = responseAt - response.durationMs;
  const pairId = crypto.randomUUID();
  const job = parseJob(unwrapJob(body));
  return {
    ...job,
    timeline: [
      ...job.timeline,
      {
        id: crypto.randomUUID(),
        pairId,
        timestamp: startedAt,
        direction: 'REQUEST',
        source: 'testbed',
        target: 'trasolve',
        method: 'POST',
        label: L('testbed:tcacheRoute.cancelTcacheRouteJob.label.postCancel'),
        path,
      },
      {
        id: crypto.randomUUID(),
        pairId,
        timestamp: responseAt,
        direction: 'RESPONSE',
        source: 'trasolve',
        target: 'testbed',
        method: 'POST',
        label: L('testbed:tcacheRoute.cancelTcacheRouteJob.label.postCancel'),
        path,
        status: response.httpStatus,
        latencyMs: response.durationMs,
        body,
      },
    ],
  };
}

export function getTcacheRouteJobPath(jobId: string): string {
  return getApiTcacheRouteJobPath(jobId);
}

export function getTcacheRouteEventsPath(jobId: string): string {
  return getTcacheRouteJobEventsPath(jobId);
}

export function subscribeTcacheRouteEvents(
  jobId: string,
  options: TcacheRouteSubscriptionOptions,
): Promise<void> {
  return subscribeTcacheRouteJobEvents(jobId, options);
}

export async function getTcacheRouteResult(
  jobId: string,
  signal?: AbortSignal,
): Promise<{
  result: TcacheRouteResult;
  body: unknown;
  httpStatus: number;
  durationMs: number;
}> {
  const response = await requestTcacheRouteJobResult(jobId, signal);
  return {
    result: parseResult(
      isRecord(response.body) && response.body.result !== undefined
        ? response.body.result
        : response.body,
    ),
    body: response.body,
    httpStatus: response.httpStatus,
    durationMs: response.durationMs,
  };
}

export function parseTcacheRouteJobEvent(data: string): TcacheRouteJob {
  let body: unknown;
  try {
    body = JSON.parse(data) as unknown;
  } catch (cause) {
    captureUnexpectedApiException(cause, {
      operation: 'tcache.parse-job-event',
    });
    throw cause;
  }
  return parseJob(unwrapJob(body));
}

function toCreateLocation(
  location: TcacheRouteRequest['locations'][number],
): TcacheRouteCreateLocation {
  if (location.lat !== undefined && location.lng !== undefined) {
    return { latitude: location.lat, longitude: location.lng };
  }
  if (location.placeId) {
    return { placeId: location.placeId };
  }
  if (location.address) {
    return { address: location.address };
  }
  throw new Error(
    L(
      'testbed:tcacheJobBuilderModel.validateTcacheJobBuilder.text.selectLocationUsingLocationSearch',
    ),
  );
}

function unwrapJob(value: unknown): unknown {
  return isRecord(value) && value.job !== undefined ? value.job : value;
}
