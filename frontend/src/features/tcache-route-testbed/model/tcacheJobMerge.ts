import type {
  TcacheRouteJob,
  TcacheRouteRequest,
} from '@/features/tcache-route-testbed/model/types';
import {
  normalizeEventStatus,
  readEventString,
  readEventNumber,
} from '@/features/tcache-route-testbed/model/tcacheEventPayload';

export function mergeJob(
  current: TcacheRouteJob[],
  incoming: TcacheRouteJob,
): TcacheRouteJob[] {
  const index = current.findIndex((job) => job.id === incoming.id);
  if (index < 0) {
    return [incoming, ...current];
  }
  const existing = current[index]!;
  if (incoming.updatedAt < existing.updatedAt) {
    return current;
  }
  const timeline = [...existing.timeline, ...incoming.timeline]
    .filter(
      (entry, index, entries) =>
        entries.findIndex((candidate) => candidate.id === entry.id) === index,
    )
    .sort((left, right) => left.timestamp - right.timestamp);
  const merged = {
    ...incoming,
    request:
      incoming.request.locations.length > 0
        ? mergeRequestMetadata(existing.request, incoming.request)
        : existing.request,
    ...(incoming.result
      ? {}
      : existing.result
        ? { result: existing.result }
        : {}),
    ...(existing.sseState ? { sseState: existing.sseState } : {}),
    timeline,
  };
  const next = [...current];
  next[index] = merged;
  return next;
}

export function mergeJobList(
  current: TcacheRouteJob[],
  incoming: TcacheRouteJob[],
  localJobIds: ReadonlySet<string>,
): TcacheRouteJob[] {
  return incoming
    .reduce(mergeJob, current)
    .filter(
      (job) =>
        localJobIds.has(job.id) ||
        incoming.some((remote) => remote.id === job.id),
    );
}

export function mergePartialState(
  current: TcacheRouteJob,
  payload: Record<string, unknown> | null,
  timestamp: number,
): TcacheRouteJob {
  if (!payload) {
    return current;
  }
  const progress = readEventNumber(payload, 'progress');
  const stage = readEventString(payload, 'stage');
  const message = readEventString(payload, 'message');
  const status = normalizeEventStatus(payload.status);
  return {
    ...current,
    updatedAt: timestamp,
    ...(status ? { status } : {}),
    ...(progress === undefined
      ? {}
      : { progress: Math.max(0, Math.min(100, progress)) }),
    ...(stage ? { stage } : {}),
    ...(message ? { message } : {}),
    progressEvent: {
      stage: stage ?? current.stage ?? 'running',
      progress: progress ?? current.progress,
      ...(message ? { message } : {}),
      timestamp,
    },
  };
}

export function mergeRequestMetadata(
  local: TcacheRouteRequest,
  remote: TcacheRouteRequest,
): TcacheRouteRequest {
  return {
    ...remote,
    locations: remote.locations.map((location, index) => {
      const matching = location.placeId
        ? local.locations.find(
            (candidate) => candidate.placeId === location.placeId,
          )
        : local.locations[index];
      if (!matching) {
        return location;
      }
      const address = location.address ?? matching.address;
      const lat = location.lat ?? matching.lat;
      const lng = location.lng ?? matching.lng;
      return {
        ...location,
        id: matching.id,
        name: location.name === location.id ? matching.name : location.name,
        ...(address ? { address } : {}),
        ...(lat === undefined ? {} : { lat }),
        ...(lng === undefined ? {} : { lng }),
      };
    }),
  };
}
