import type { TcacheRouteResult } from '@/features/tcache-route-testbed/model/types';
import { L } from '@/shared/i18n';
import {
  parseBounds,
  parsePath,
  parsePoint,
} from '@/features/tcache-route-testbed/api/tcacheGeometry';
import {
  readCacheStatus,
  readOptionalString,
  readNumber,
  readOptionalNumber,
  isRecord,
} from '@/features/tcache-route-testbed/api/tcacheContract';

export function parseResult(value: unknown): TcacheRouteResult {
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

export function parseRouteAlternative(
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
        readOptionalString(value, ['label', 'summary']) ??
        L('testbed:routeResultPanel.text.path', { value: index + 1 }),
      path,
      legs,
      ...(bounds ? { bounds } : {}),
      ...(distanceMeters === undefined ? {} : { distanceMeters }),
      ...(durationSeconds === undefined ? {} : { durationSeconds }),
      ...(provider ? { provider } : {}),
    },
  ];
}

export function parseLeg(value: unknown, index: number) {
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
    value.start ??
      value.start_location ??
      value.startLocation ??
      value.origin_location ??
      value.originLocation,
  );
  const end = parsePoint(
    value.end ??
      value.end_location ??
      value.endLocation ??
      value.destination_location ??
      value.destinationLocation,
  );
  const path = parsePath(
    value.path ?? value.polyline ?? value.coordinates ?? value.points,
  );
  const steps = Array.isArray(value.steps)
    ? value.steps.flatMap((step) => parseStep(step))
    : [];
  return [
    {
      from:
        readOptionalString(value, ['from', 'origin']) ??
        L('testbed:tcacheRoute.parseLeg.text.interval', { value: index + 1 }),
      to:
        readOptionalString(value, ['to', 'destination']) ??
        L('testbed:tcacheRoute.parseLeg.text.interval', { value: index + 2 }),
      ...(distanceMeters === undefined ? {} : { distanceMeters }),
      ...(durationSeconds === undefined ? {} : { durationSeconds }),
      ...(start ? { start } : {}),
      ...(end ? { end } : {}),
      ...(path.length ? { path } : {}),
      steps,
    },
  ];
}

export function parseStep(value: unknown) {
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
    value.start ?? value.start_location ?? value.startLocation,
  );
  const end = parsePoint(value.end ?? value.end_location ?? value.endLocation);
  const travelMode = readOptionalString(value, ['travel_mode', 'travelMode']);
  const instruction = readOptionalString(value, ['instruction']);
  const transitDetails = parseTransitDetails(
    value.transit_details ?? value.transitDetails,
  );
  return [
    {
      ...(distanceMeters === undefined ? {} : { distanceMeters }),
      ...(durationSeconds === undefined ? {} : { durationSeconds }),
      ...(start ? { start } : {}),
      ...(end ? { end } : {}),
      ...(travelMode ? { travelMode } : {}),
      ...(instruction ? { instruction } : {}),
      ...(transitDetails ? { transitDetails } : {}),
    },
  ];
}

export function parseTransitDetails(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }
  const stops = Array.isArray(value.stops)
    ? value.stops.flatMap((stop) => {
        if (!isRecord(stop)) {
          return [];
        }
        const name = readOptionalString(stop, ['name']);
        return name ? [{ name }] : [{}];
      })
    : [];
  const vehicles = Array.isArray(value.vehicles)
    ? value.vehicles.flatMap((vehicle) => {
        if (!isRecord(vehicle)) {
          return [];
        }
        const name = readOptionalString(vehicle, ['name']);
        const type = readOptionalString(vehicle, ['type']);
        return name || type
          ? [{ ...(name ? { name } : {}), ...(type ? { type } : {}) }]
          : [];
      })
    : [];
  const stopCount = readOptionalNumber(value, ['stop_count', 'stopCount']);
  return {
    ...readOptionalField(value, 'departureStop', [
      'departure_stop',
      'departureStop',
    ]),
    ...readOptionalField(value, 'arrivalStop', ['arrival_stop', 'arrivalStop']),
    ...readOptionalField(value, 'departureTime', [
      'departure_time',
      'departureTime',
    ]),
    ...readOptionalField(value, 'arrivalTime', ['arrival_time', 'arrivalTime']),
    ...readOptionalField(value, 'lineName', ['line_name', 'lineName']),
    ...readOptionalField(value, 'lineShortName', [
      'line_short_name',
      'lineShortName',
    ]),
    ...readOptionalField(value, 'headsign', ['headsign']),
    ...(stopCount === undefined ? {} : { stopCount }),
    ...readOptionalField(value, 'vehicleType', ['vehicle_type', 'vehicleType']),
    stops,
    vehicles,
  };
}

function readOptionalField<Key extends string>(
  value: Record<string, unknown>,
  key: Key,
  aliases: string[],
): Partial<Record<Key, string>> {
  const result = readOptionalString(value, aliases);
  return result ? ({ [key]: result } as Partial<Record<Key, string>>) : {};
}
