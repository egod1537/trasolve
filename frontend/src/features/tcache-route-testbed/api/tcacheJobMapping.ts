import type {
  TcacheRouteJob,
  TcacheRouteRequest,
} from '@/features/tcache-route-testbed/model/types';
import { L } from '@/shared/i18n';
import { parseResult } from '@/features/tcache-route-testbed/api/tcacheResultMapping';
import {
  readStatus,
  readCacheStatus,
  readString,
  readOptionalString,
  readNumber,
  readOptionalNumber,
  readTimestamp,
  readOptionalTimestamp,
  isRecord,
  tcacheContractViolation,
} from '@/features/tcache-route-testbed/api/tcacheContract';

export function parseJob(value: unknown): TcacheRouteJob {
  if (!isRecord(value)) {
    throw tcacheContractViolation(
      'tcache.validate-job',
      L('testbed:tcacheRouteTestbed.errorMessage.text.unknownErrorOccurred'),
    );
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

export function parseRequest(value: unknown): TcacheRouteRequest {
  if (value === undefined || value === null) {
    return { locations: [], mode: 'TRANSIT', departureTime: '' };
  }
  if (!isRecord(value) || !Array.isArray(value.locations)) {
    throw tcacheContractViolation(
      'tcache.validate-job-request',
      L('testbed:tcacheRouteTestbed.errorMessage.text.unknownErrorOccurred'),
    );
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
    ...readRequestStringOption(value, 'countryCode', 'country_code'),
    ...readRequestStringOption(value, 'provider', 'provider'),
    ...readRequestStringOption(
      value,
      'routingPreference',
      'routing_preference',
    ),
    ...readRequestStringOption(value, 'units', 'units'),
  };
}

export function readMode(value: unknown): TcacheRouteRequest['mode'] {
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

export function readRequestStringOption(
  value: Record<string, unknown>,
  camelKey:
    | 'languageCode'
    | 'regionCode'
    | 'countryCode'
    | 'provider'
    | 'routingPreference'
    | 'units',
  snakeKey: string,
): Partial<TcacheRouteRequest> {
  const option = readOptionalString(value, [camelKey, snakeKey]);
  return option ? { [camelKey]: option } : {};
}

export function parseLocation(value: unknown, index: number) {
  if (!isRecord(value)) {
    throw tcacheContractViolation(
      'tcache.validate-job-location',
      L('testbed:tcacheRouteTestbed.errorMessage.text.unknownErrorOccurred'),
    );
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

export function parseTimelineEntry(value: unknown, index: number) {
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
