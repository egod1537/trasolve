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
    throw new Error('tcache Route Job 목록 응답 형식이 올바르지 않습니다.');
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
      throw new Error('tcache Route Job 생성 응답에 Job ID가 없습니다.');
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
        label: 'POST cancel',
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
        label: 'POST cancel',
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
  return parseJob(unwrapJob(JSON.parse(data) as unknown));
}

function toCreateLocation(
  location: TcacheRouteRequest['locations'][number],
): TcacheRouteCreateLocation {
  if (location.placeId) {
    return { placeId: location.placeId };
  }
  if (location.address) {
    return { address: location.address };
  }
  if (location.lat !== undefined && location.lng !== undefined) {
    return { latitude: location.lat, longitude: location.lng };
  }
  throw new Error(
    `${location.name} 위치에 Place ID, 주소 또는 좌표가 없습니다.`,
  );
}

function unwrapJob(value: unknown): unknown {
  return isRecord(value) && value.job !== undefined ? value.job : value;
}

function parseJob(value: unknown): TcacheRouteJob {
  if (!isRecord(value)) {
    throw new Error('tcache Route Job 응답 형식이 올바르지 않습니다.');
  }
  const id = readString(value, ['job_id', 'jobId', 'id']);
  const status = readStatus(value.status ?? 'queued');
  const request = parseRequest(value.request);
  const createdAt = readTimestamp(
    value,
    ['created_at', 'createdAt'],
    Date.now(),
  );
  const updatedAt = readTimestamp(
    value,
    ['updated_at', 'updatedAt'],
    createdAt,
  );
  const progress = readNumber(
    value,
    ['progress'],
    status === 'completed' ? 100 : 0,
  );
  const timelineSource = Array.isArray(value.timeline) ? value.timeline : [];
  const result =
    value.result === undefined ? undefined : parseResult(value.result);
  const stage = readOptionalString(value, ['stage']);
  const message = readOptionalString(value, ['message']);
  const eventsUrl = readOptionalString(value, ['events_url', 'eventsUrl']);
  const statusUrl = readOptionalString(value, ['status_url', 'statusUrl']);
  const resultUrl = readOptionalString(value, ['result_url', 'resultUrl']);
  return {
    id,
    status,
    createdAt,
    updatedAt,
    progress: Math.max(0, Math.min(100, progress)),
    request,
    timeline: timelineSource.flatMap(parseTimelineEntry),
    ...(stage ? { stage } : {}),
    ...(message ? { message } : {}),
    ...(eventsUrl ? { eventsUrl } : {}),
    ...(statusUrl ? { statusUrl } : {}),
    ...(resultUrl ? { resultUrl } : {}),
    ...(readOptionalString(value, ['provider'])
      ? { provider: readString(value, ['provider']) }
      : {}),
    ...(readCacheStatus(value.cache_status ?? value.cacheStatus)
      ? {
          cacheStatus: readCacheStatus(value.cache_status ?? value.cacheStatus),
        }
      : {}),
    ...(result ? { result } : {}),
    ...(readOptionalString(value, ['error'])
      ? { error: readString(value, ['error']) }
      : {}),
    ...(readOptionalTimestamp(value, ['completed_at', 'completedAt'])
      ? {
          completedAt: readOptionalTimestamp(value, [
            'completed_at',
            'completedAt',
          ]),
        }
      : {}),
    ...(stage || message
      ? {
          progressEvent: {
            stage: stage ?? status,
            progress: Math.max(0, Math.min(100, progress)),
            ...(message ? { message } : {}),
            timestamp: updatedAt,
          },
        }
      : {}),
  };
}

function parseRequest(value: unknown): TcacheRouteRequest {
  if (value === undefined || value === null) {
    return { locations: [], mode: 'TRANSIT', departureTime: '' };
  }
  if (!isRecord(value) || !Array.isArray(value.locations)) {
    throw new Error('tcache Route Job request 형식이 올바르지 않습니다.');
  }
  const departureTime = readOptionalString(value, [
    'departure_time',
    'departureTime',
  ]);
  return {
    mode: readMode(value.mode),
    locations: value.locations.map((location, index) =>
      parseLocation(location, index),
    ),
    departureTime: departureTime ?? '',
    ...(typeof value.computeAlternativeRoutes === 'boolean'
      ? { computeAlternativeRoutes: value.computeAlternativeRoutes }
      : typeof value.compute_alternative_routes === 'boolean'
        ? { computeAlternativeRoutes: value.compute_alternative_routes }
        : {}),
    ...readRequestStringOption(value, 'languageCode', 'language_code'),
    ...readRequestStringOption(value, 'regionCode', 'region_code'),
    ...readRequestStringOption(
      value,
      'routingPreference',
      'routing_preference',
    ),
    ...readRequestStringOption(value, 'units', 'units'),
  };
}

function readMode(value: unknown): TcacheRouteRequest['mode'] {
  if (
    value === 'DRIVING' ||
    value === 'WALKING' ||
    value === 'BICYCLING' ||
    value === 'TRANSIT'
  ) {
    return value;
  }
  if (value === 'DRIVE') {
    return 'DRIVING';
  }
  if (value === 'WALK') {
    return 'WALKING';
  }
  if (value === 'BICYCLE') {
    return 'BICYCLING';
  }
  return 'TRANSIT';
}

function readRequestStringOption(
  value: Record<string, unknown>,
  camelKey: 'languageCode' | 'regionCode' | 'routingPreference' | 'units',
  snakeKey: string,
): Partial<TcacheRouteRequest> {
  const option = readOptionalString(value, [camelKey, snakeKey]);
  return option ? { [camelKey]: option } : {};
}

function parseLocation(value: unknown, index: number) {
  if (!isRecord(value)) {
    throw new Error('tcache Route location 형식이 올바르지 않습니다.');
  }
  const id = readOptionalString(value, ['id']) ?? `location-${index + 1}`;
  const name = readOptionalString(value, ['name', 'label', 'address']) ?? id;
  const placeId = readOptionalString(value, ['place_id', 'placeId']);
  const address = readOptionalString(value, ['address']);
  const lat = readOptionalNumber(value, ['lat', 'latitude']);
  const lng = readOptionalNumber(value, ['lng', 'longitude']);
  return {
    id,
    name,
    ...(placeId ? { placeId } : {}),
    ...(address ? { address } : {}),
    ...(lat === undefined ? {} : { lat }),
    ...(lng === undefined ? {} : { lng }),
  };
}

function parseResult(value: unknown): TcacheRouteResult {
  const source = isRecord(value) ? value : {};
  const routeSources = Array.isArray(source.routes) ? source.routes : [source];
  const routes = routeSources.flatMap((route, index) =>
    parseRouteAlternative(route, index, source),
  );
  const primaryRoute = routes[0];
  const legs = primaryRoute?.legs ?? [];
  const cacheStatus = readCacheStatus(
    source.cache_status ?? source.cacheStatus,
  );
  const provider = readOptionalString(source, ['provider']);
  const distanceMeters = readOptionalNumber(source, [
    'distance_meters',
    'distanceMeters',
  ]);
  const durationSeconds = readOptionalNumber(source, [
    'duration_seconds',
    'durationSeconds',
  ]);
  const latencyMs = readOptionalNumber(source, ['latency_ms', 'latencyMs']);
  const resolvedProvider = provider ?? primaryRoute?.provider;
  const resolvedDistance = distanceMeters ?? primaryRoute?.distanceMeters;
  const resolvedDuration = durationSeconds ?? primaryRoute?.durationSeconds;
  return {
    routeCount: readNumber(
      source,
      ['route_count', 'routeCount'],
      Math.max(1, routes.length),
    ),
    legs,
    routes,
    raw: value,
    ...(resolvedProvider ? { provider: resolvedProvider } : {}),
    ...(cacheStatus ? { cacheStatus } : {}),
    ...(resolvedDistance === undefined
      ? {}
      : { distanceMeters: resolvedDistance }),
    ...(resolvedDuration === undefined
      ? {}
      : { durationSeconds: resolvedDuration }),
    ...(latencyMs === undefined ? {} : { latencyMs }),
  };
}

function parseRouteAlternative(
  value: unknown,
  index: number,
  result: Record<string, unknown>,
) {
  if (!isRecord(value)) {
    return [];
  }
  const legsSource = Array.isArray(value.legs)
    ? value.legs
    : index === 0 && Array.isArray(result.legs)
      ? result.legs
      : [];
  const legs = legsSource.flatMap((leg, legIndex) => parseLeg(leg, legIndex));
  const directPath = parsePath(
    value.path ?? value.polyline ?? value.coordinates ?? value.points,
  );
  const path = directPath.length
    ? directPath
    : legs.flatMap((leg, legIndex) =>
        leg.path?.length ? (legIndex === 0 ? leg.path : leg.path.slice(1)) : [],
      );
  const distanceMeters = readOptionalNumber(value, [
    'distance_meters',
    'distanceMeters',
    'distance',
  ]);
  const durationSeconds = readOptionalNumber(value, [
    'duration_seconds',
    'durationSeconds',
    'duration',
  ]);
  const provider = readOptionalString(value, ['provider']);
  const bounds = parseBounds(value.bounds ?? value.viewport);
  return [
    {
      id:
        readOptionalString(value, ['id', 'route_id', 'routeId']) ??
        `route-${index + 1}`,
      label:
        readOptionalString(value, ['label', 'summary']) ?? `경로 ${index + 1}`,
      path,
      legs,
      ...(bounds ? { bounds } : {}),
      ...(distanceMeters === undefined ? {} : { distanceMeters }),
      ...(durationSeconds === undefined ? {} : { durationSeconds }),
      ...(provider ? { provider } : {}),
    },
  ];
}

function parseBounds(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }
  const north = readOptionalNumber(value, ['north']);
  const south = readOptionalNumber(value, ['south']);
  const east = readOptionalNumber(value, ['east']);
  const west = readOptionalNumber(value, ['west']);
  if (
    north !== undefined &&
    south !== undefined &&
    east !== undefined &&
    west !== undefined
  ) {
    return { north, south, east, west };
  }
  const northeast = parsePoint(value.northeast ?? value.high);
  const southwest = parsePoint(value.southwest ?? value.low);
  return northeast && southwest
    ? {
        north: northeast.lat,
        south: southwest.lat,
        east: northeast.lng,
        west: southwest.lng,
      }
    : undefined;
}

function parseLeg(value: unknown, index: number) {
  if (!isRecord(value)) {
    return [];
  }
  const distanceMeters = readOptionalNumber(value, [
    'distance_meters',
    'distanceMeters',
  ]);
  const durationSeconds = readOptionalNumber(value, [
    'duration_seconds',
    'durationSeconds',
  ]);
  const start = parsePoint(
    value.start ?? value.origin_location ?? value.originLocation,
  );
  const end = parsePoint(
    value.end ?? value.destination_location ?? value.destinationLocation,
  );
  const path = parsePath(
    value.path ?? value.polyline ?? value.coordinates ?? value.points,
  );
  return [
    {
      from:
        readOptionalString(value, ['from', 'origin']) ?? `구간 ${index + 1}`,
      to:
        readOptionalString(value, ['to', 'destination']) ?? `구간 ${index + 2}`,
      ...(distanceMeters === undefined ? {} : { distanceMeters }),
      ...(durationSeconds === undefined ? {} : { durationSeconds }),
      ...(start ? { start } : {}),
      ...(end ? { end } : {}),
      ...(path.length ? { path } : {}),
    },
  ];
}

function parsePath(value: unknown) {
  if (typeof value === 'string') {
    return decodeGooglePolyline(value);
  }
  if (isRecord(value)) {
    const encoded = readOptionalString(value, [
      'encodedPolyline',
      'encoded_polyline',
      'points',
    ]);
    if (encoded) {
      return decodeGooglePolyline(encoded);
    }
    return parsePath(
      value.coordinates ??
        value.path ??
        value.geoJsonLinestring ??
        value.geo_json_linestring,
    );
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((point) => {
    const parsed = parsePoint(point);
    return parsed ? [parsed] : [];
  });
}

function parsePoint(value: unknown) {
  if (Array.isArray(value) && value.length >= 2) {
    const first = value[0];
    const second = value[1];
    if (
      typeof first === 'number' &&
      Number.isFinite(first) &&
      typeof second === 'number' &&
      Number.isFinite(second)
    ) {
      return Math.abs(first) > 90 && Math.abs(second) <= 90
        ? { lat: second, lng: first }
        : { lat: first, lng: second };
    }
    return undefined;
  }
  if (!isRecord(value)) {
    return undefined;
  }
  const lat = readOptionalNumber(value, ['lat', 'latitude']);
  const lng = readOptionalNumber(value, ['lng', 'longitude']);
  return lat === undefined || lng === undefined ? undefined : { lat, lng };
}

function decodeGooglePolyline(value: string) {
  const points: { lat: number; lng: number }[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  while (index < value.length) {
    const latitudeDelta = decodePolylineValue(value, index);
    if (!latitudeDelta) {
      break;
    }
    index = latitudeDelta.nextIndex;
    const longitudeDelta = decodePolylineValue(value, index);
    if (!longitudeDelta) {
      break;
    }
    index = longitudeDelta.nextIndex;
    latitude += latitudeDelta.value;
    longitude += longitudeDelta.value;
    points.push({ lat: latitude / 1e5, lng: longitude / 1e5 });
  }
  return points;
}

function decodePolylineValue(
  encoded: string,
  startIndex: number,
): { value: number; nextIndex: number } | null {
  let index = startIndex;
  let result = 0;
  let shift = 0;
  let byte = 0;
  do {
    if (index >= encoded.length) {
      return null;
    }
    byte = encoded.charCodeAt(index) - 63;
    index += 1;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20 && shift < 32);
  return {
    value: result & 1 ? ~(result >> 1) : result >> 1,
    nextIndex: index,
  };
}

function parseTimelineEntry(value: unknown, index: number) {
  if (!isRecord(value)) {
    return [];
  }
  const path = readOptionalString(value, ['path']);
  const status = readOptionalNumber(value, ['status']);
  const latencyMs = readOptionalNumber(value, ['latency_ms', 'latencyMs']);
  return [
    {
      id: readOptionalString(value, ['id']) ?? `timeline-${index}`,
      timestamp: readTimestamp(value, ['timestamp'], Date.now()),
      direction: readOptionalString(value, ['direction']) ?? 'EVENT',
      label: readOptionalString(value, ['label', 'event', 'method']) ?? 'event',
      ...(path ? { path } : {}),
      ...(status === undefined ? {} : { status }),
      ...(latencyMs === undefined ? {} : { latencyMs }),
      ...(value.body === undefined ? {} : { body: value.body }),
    },
  ];
}

function readStatus(value: unknown): TcacheRouteJob['status'] {
  if (
    value === 'queued' ||
    value === 'running' ||
    value === 'completed' ||
    value === 'failed' ||
    value === 'cancelled'
  ) {
    return value;
  }
  if (value === 'pending' || value === 'accepted') {
    return 'queued';
  }
  throw new Error('알 수 없는 tcache Route Job 상태입니다.');
}

function readCacheStatus(value: unknown): TcacheRouteJob['cacheStatus'] {
  if (value === 'hit' || value === 'HIT') {
    return 'hit';
  }
  if (value === 'miss' || value === 'MISS') {
    return 'miss';
  }
  if (value === 'unknown' || value === 'UNKNOWN') {
    return 'unknown';
  }
  return undefined;
}

function readString(value: Record<string, unknown>, keys: string[]): string {
  const result = readOptionalString(value, keys);
  if (result === undefined) {
    throw new Error(`${keys[0]} 값이 없습니다.`);
  }
  return result;
}

function readOptionalString(
  value: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    if (typeof value[key] === 'string' && value[key].length > 0) {
      return value[key];
    }
  }
  return undefined;
}

function readNumber(
  value: Record<string, unknown>,
  keys: string[],
  fallback: number,
): number {
  return readOptionalNumber(value, keys) ?? fallback;
}

function readOptionalNumber(
  value: Record<string, unknown>,
  keys: string[],
): number | undefined {
  for (const key of keys) {
    if (typeof value[key] === 'number' && Number.isFinite(value[key])) {
      return value[key];
    }
  }
  return undefined;
}

function readTimestamp(
  value: Record<string, unknown>,
  keys: string[],
  fallback: number,
): number {
  return readOptionalTimestamp(value, keys) ?? fallback;
}

function readOptionalTimestamp(
  value: Record<string, unknown>,
  keys: string[],
): number | undefined {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
    if (typeof candidate === 'string') {
      const parsed = Date.parse(candidate);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
