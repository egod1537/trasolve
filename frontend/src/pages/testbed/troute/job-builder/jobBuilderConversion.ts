import type { TrouteOptimizeRequest } from '@trasolve/shared';
import type { JobBuilderLocation, JobBuilderState } from './jobBuilderModel';

export function createVisualJobId(): string {
  return `route-testbed-${crypto.randomUUID()}`;
}

export function jobBuilderToOptimizeRequest(
  state: JobBuilderState,
  jobId: string,
): TrouteOptimizeRequest {
  return {
    job_id: jobId,
    // The troute contract derives endpoints from order: first is the fixed
    // start, last is the fixed destination, and middle entries are candidates.
    locations: state.locations.map((location) => ({
      id: location.id,
      place_id: location.placeId,
      open_time: location.openTime,
      close_time: location.closeTime,
      stay_minutes: location.stayMinutes,
    })),
    start_time: state.startTime,
  };
}

export function applyOptimizeRequestToBuilder(
  current: JobBuilderState,
  request: TrouteOptimizeRequest,
): JobBuilderState | null {
  const locations: JobBuilderLocation[] = [];
  for (const requested of request.locations) {
    const existing = current.locations.find(
      (location) =>
        location.id === requested.id && location.placeId === requested.place_id,
    );
    if (!existing) {
      return null;
    }
    locations.push({
      ...existing,
      openTime: requested.open_time,
      closeTime: requested.close_time,
      stayMinutes: requested.stay_minutes,
    });
  }
  return {
    locations,
    startTime: request.start_time,
  };
}
