import type { TrouteOptimizeRequest } from '@trasolve/shared';
import type {
  JobBuilderLocation,
  JobBuilderState,
} from '@/features/troute-testbed/job-builder/jobBuilderModel';
import {
  DEFAULT_MIN_JOB_DURATION_MS,
  DEFAULT_TROUTE_TRAVEL_MODE,
} from '@/features/troute-testbed/job-builder/jobBuilderModel';

export type JobBuilderOptimizeRequestDraft = Omit<
  TrouteOptimizeRequest,
  'travel_time_matrix'
> & {
  travel_time_matrix?: Array<Array<number | null>>;
};

export function createVisualJobId(): string {
  return `route-testbed-${crypto.randomUUID()}`;
}

export function jobBuilderToOptimizeRequest(
  state: JobBuilderState,
  jobId: string,
): JobBuilderOptimizeRequestDraft {
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
    travel_mode: state.travelMode,
    ...(state.travelTimeSource === 'direct'
      ? {
          travel_time_matrix: state.travelTimeMatrix.map((row) => [...row]),
        }
      : {}),
    ...(state.debug.enabled
      ? {
          debug: {
            min_job_duration_ms: state.debug.minJobDurationMs,
            shuffle_result_route: state.debug.shuffleResultRoute,
          },
        }
      : {}),
  };
}

export function applyOptimizeRequestToBuilder(
  current: JobBuilderState,
  request: TrouteOptimizeRequest,
): JobBuilderState | null {
  const locations: JobBuilderLocation[] = [];
  for (const requested of request.locations) {
    const existing = current.locations.find(
      (location) => location.id === requested.id,
    );
    if (!existing) {
      return null;
    }
    locations.push({
      ...existing,
      placeId: requested.place_id,
      openTime: requested.open_time,
      closeTime: requested.close_time,
      stayMinutes: requested.stay_minutes,
    });
  }
  return {
    locations,
    startTime: request.start_time ?? current.startTime,
    travelMode: request.travel_mode ?? DEFAULT_TROUTE_TRAVEL_MODE,
    travelTimeSource:
      request.travel_time_matrix === undefined ? 'tcache' : 'direct',
    travelTimeMatrix:
      request.travel_time_matrix?.map((row) => [...row]) ??
      remapTravelTimeMatrix(current, locations),
    debug: {
      enabled: request.debug !== undefined,
      minJobDurationMs:
        request.debug?.min_job_duration_ms ?? DEFAULT_MIN_JOB_DURATION_MS,
      shuffleResultRoute: request.debug?.shuffle_result_route ?? false,
    },
  };
}

function remapTravelTimeMatrix(
  current: JobBuilderState,
  locations: readonly JobBuilderLocation[],
): Array<Array<number | null>> {
  const currentIndexById = new Map(
    current.locations.map((location, index) => [location.id, index]),
  );
  return locations.map((rowLocation, rowIndex) =>
    locations.map((columnLocation, columnIndex) => {
      if (rowIndex === columnIndex) {
        return 0;
      }
      const currentRowIndex = currentIndexById.get(rowLocation.id);
      const currentColumnIndex = currentIndexById.get(columnLocation.id);
      if (currentRowIndex === undefined || currentColumnIndex === undefined) {
        return null;
      }
      return (
        current.travelTimeMatrix[currentRowIndex]?.[currentColumnIndex] ?? null
      );
    }),
  );
}
