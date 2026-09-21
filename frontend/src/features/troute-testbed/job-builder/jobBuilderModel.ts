import type { PlaceDetails } from '@trasolve/shared';
import { getPlaceOpeningStatus } from '@/entities/place';
import { createDefaultJobBuilderLocations } from '@/features/troute-testbed/job-builder/jobBuilderFixtures';

export const DEFAULT_OPEN_TIME = '09:00';
export const DEFAULT_CLOSE_TIME = '18:00';
export const DEFAULT_STAY_MINUTES = 60;
export const DEFAULT_MIN_JOB_DURATION_MS = 4_000;
export const MAX_STAY_MINUTES = 4_294_967_295;

export interface JobBuilderLocation {
  id: string;
  placeId: string;
  name: string;
  location: {
    lat: number;
    lng: number;
  };
  openTime: string;
  closeTime: string;
  stayMinutes: number;
  address?: string;
  googleOpeningWindow?: {
    openTime: string;
    closeTime: string;
  };
}

export interface JobBuilderState {
  locations: JobBuilderLocation[];
  startTime: string;
  debug: {
    enabled: boolean;
    minJobDurationMs: number;
    shuffleResultRoute: boolean;
  };
}

export type JobBuilderLocationRole = 'start' | 'waypoint' | 'end';

export type JobBuilderLocationErrors = Partial<
  Record<'openTime' | 'closeTime' | 'stayMinutes', string>
>;

export interface JobBuilderValidation {
  valid: boolean;
  messages: string[];
  locationErrors: Record<string, JobBuilderLocationErrors>;
  startTimeError?: string;
  minJobDurationMsError?: string;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function getGoogleOpeningWindow(
  place: PlaceDetails,
): JobBuilderLocation['googleOpeningWindow'] {
  const ranges = getPlaceOpeningStatus(
    place.openingHours,
  ).timelineRanges.filter((range) => range.start >= 0 && range.end <= 24 * 60);
  if (ranges.length !== 1) {
    return undefined;
  }
  const range = ranges[0]!;
  if (
    !TIME_PATTERN.test(range.startText) ||
    !TIME_PATTERN.test(range.endText) ||
    range.startText > range.endText
  ) {
    return undefined;
  }
  return { openTime: range.startText, closeTime: range.endText };
}

export function createDefaultJobBuilderDraft(): JobBuilderState {
  return {
    locations: createDefaultJobBuilderLocations(),
    startTime: '09:00',
    debug: {
      enabled: false,
      minJobDurationMs: DEFAULT_MIN_JOB_DURATION_MS,
      shuffleResultRoute: false,
    },
  };
}

export function getJobBuilderLocationRole(
  index: number,
  total: number,
): JobBuilderLocationRole {
  if (index === 0) {
    return 'start';
  }
  if (index === total - 1) {
    return 'end';
  }
  return 'waypoint';
}

export function createJobBuilderLocation(
  place: PlaceDetails,
): JobBuilderLocation {
  const googleOpeningWindow = getGoogleOpeningWindow(place);
  return {
    id: `location-${crypto.randomUUID()}`,
    placeId: place.id,
    name: place.name,
    location: { ...place.location },
    openTime: googleOpeningWindow?.openTime ?? DEFAULT_OPEN_TIME,
    closeTime: googleOpeningWindow?.closeTime ?? DEFAULT_CLOSE_TIME,
    stayMinutes: DEFAULT_STAY_MINUTES,
    ...(place.address ? { address: place.address } : {}),
    ...(googleOpeningWindow ? { googleOpeningWindow } : {}),
  };
}

export function addJobBuilderLocation(
  state: JobBuilderState,
  location: JobBuilderLocation,
): JobBuilderState {
  if (state.locations.some((item) => item.placeId === location.placeId)) {
    return state;
  }
  const locations =
    state.locations.length < 2
      ? [...state.locations, location]
      : [
          ...state.locations.slice(0, -1),
          location,
          state.locations[state.locations.length - 1]!,
        ];
  return {
    ...state,
    locations,
  };
}

export function removeJobBuilderLocation(
  state: JobBuilderState,
  locationId: string,
): JobBuilderState {
  return {
    ...state,
    locations: state.locations.filter((location) => location.id !== locationId),
  };
}

export function reorderJobBuilderLocations(
  locations: readonly JobBuilderLocation[],
  locationId: string,
  targetIndex: number,
): JobBuilderLocation[] {
  const sourceIndex = locations.findIndex(
    (location) => location.id === locationId,
  );
  if (
    sourceIndex < 0 ||
    targetIndex < 0 ||
    targetIndex >= locations.length ||
    sourceIndex === targetIndex
  ) {
    return [...locations];
  }
  const next = [...locations];
  const [moved] = next.splice(sourceIndex, 1);
  if (!moved) {
    return next;
  }
  next.splice(targetIndex, 0, moved);
  return next;
}
