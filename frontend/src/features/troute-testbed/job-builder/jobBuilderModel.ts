import type { PlaceDetails } from '@trasolve/shared';
import { getPlaceOpeningStatus } from '@/entities/place';
import { createDefaultJobBuilderLocations } from '@/features/troute-testbed/job-builder/jobBuilderFixtures';

export const DEFAULT_OPEN_TIME = '09:00';
export const DEFAULT_CLOSE_TIME = '18:00';
export const DEFAULT_STAY_MINUTES = 60;
export const DEFAULT_MIN_JOB_DURATION_MS = 4_000;
export const MAX_STAY_MINUTES = 4_294_967_295;

export type JobBuilderTravelTimeSource = 'tcache' | 'direct';
export type JobBuilderTravelTimeMatrixCell = number | null;

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
  travelTimeSource: JobBuilderTravelTimeSource;
  travelTimeMatrix: JobBuilderTravelTimeMatrixCell[][];
  debug: {
    enabled: boolean;
    minJobDurationMs: number;
    shuffleResultRoute: boolean;
  };
}

export type JobBuilderLocationRole = 'start' | 'waypoint' | 'end';

export type JobBuilderLocationErrors = Partial<
  Record<'placeId' | 'openTime' | 'closeTime' | 'stayMinutes', string>
>;

export interface JobBuilderValidation {
  valid: boolean;
  messages: string[];
  locationErrors: Record<string, JobBuilderLocationErrors>;
  startTimeError?: string;
  minJobDurationMsError?: string;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const SHUFFLE_ATTEMPTS = 3;

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
  const locations = createDefaultJobBuilderLocations();
  return {
    locations,
    startTime: '09:00',
    travelTimeSource: 'direct',
    travelTimeMatrix: createEmptyTravelTimeMatrix(locations.length),
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
  return replaceJobBuilderLocations(state, locations);
}

export function removeJobBuilderLocation(
  state: JobBuilderState,
  locationId: string,
): JobBuilderState {
  const locations = state.locations.filter(
    (location) => location.id !== locationId,
  );
  return replaceJobBuilderLocations(state, locations);
}

export function reorderJobBuilderLocation(
  state: JobBuilderState,
  locationId: string,
  targetIndex: number,
): JobBuilderState {
  const locations = reorderJobBuilderLocations(
    state.locations,
    locationId,
    targetIndex,
  );
  return replaceJobBuilderLocations(state, locations);
}

export function canShuffleJobBuilderLocations(
  locations: readonly JobBuilderLocation[],
): boolean {
  return locations.length >= 2;
}

export function shuffleJobBuilderLocations(
  state: JobBuilderState,
  random: () => number = Math.random,
): JobBuilderState {
  if (!canShuffleJobBuilderLocations(state.locations)) {
    return state;
  }

  for (let attempt = 0; attempt < SHUFFLE_ATTEMPTS; attempt += 1) {
    const locations = fisherYatesShuffle(state.locations, random);
    if (!hasSameLocationOrder(state.locations, locations)) {
      return replaceJobBuilderLocations(state, locations);
    }
  }

  const [first, ...remaining] = state.locations;
  return replaceJobBuilderLocations(state, [...remaining, first!]);
}

export function updateJobBuilderTravelTimeMatrixCell(
  state: JobBuilderState,
  rowIndex: number,
  columnIndex: number,
  value: JobBuilderTravelTimeMatrixCell,
): JobBuilderState {
  if (
    rowIndex === columnIndex ||
    rowIndex < 0 ||
    columnIndex < 0 ||
    rowIndex >= state.locations.length ||
    columnIndex >= state.locations.length
  ) {
    return state;
  }
  return {
    ...state,
    travelTimeMatrix: state.travelTimeMatrix.map((row, currentRowIndex) =>
      currentRowIndex === rowIndex
        ? row.map((cell, currentColumnIndex) =>
            currentColumnIndex === columnIndex ? value : cell,
          )
        : [...row],
    ),
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

export function createEmptyTravelTimeMatrix(
  size: number,
): JobBuilderTravelTimeMatrixCell[][] {
  return Array.from({ length: size }, (_, rowIndex) =>
    Array.from({ length: size }, (_, columnIndex) =>
      rowIndex === columnIndex ? 0 : null,
    ),
  );
}

function replaceJobBuilderLocations(
  state: JobBuilderState,
  locations: readonly JobBuilderLocation[],
): JobBuilderState {
  return {
    ...state,
    locations: [...locations],
    travelTimeMatrix: synchronizeTravelTimeMatrix(
      state.locations,
      state.travelTimeMatrix,
      locations,
    ),
  };
}

function fisherYatesShuffle(
  locations: readonly JobBuilderLocation[],
  random: () => number,
): JobBuilderLocation[] {
  const shuffled = [...locations];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const sample = random();
    const normalizedSample = Number.isFinite(sample)
      ? Math.min(Math.max(sample, 0), 1 - Number.EPSILON)
      : 0;
    const targetIndex = Math.floor(normalizedSample * (index + 1));
    [shuffled[index], shuffled[targetIndex]] = [
      shuffled[targetIndex]!,
      shuffled[index]!,
    ];
  }
  return shuffled;
}

function hasSameLocationOrder(
  left: readonly JobBuilderLocation[],
  right: readonly JobBuilderLocation[],
): boolean {
  return left.every((location, index) => location.id === right[index]?.id);
}

function synchronizeTravelTimeMatrix(
  previousLocations: readonly JobBuilderLocation[],
  previousMatrix: readonly (readonly JobBuilderTravelTimeMatrixCell[])[],
  locations: readonly JobBuilderLocation[],
): JobBuilderTravelTimeMatrixCell[][] {
  const previousIndexById = new Map(
    previousLocations.map((location, index) => [location.id, index]),
  );
  return locations.map((rowLocation, rowIndex) =>
    locations.map((columnLocation, columnIndex) => {
      if (rowIndex === columnIndex) {
        return 0;
      }
      const previousRowIndex = previousIndexById.get(rowLocation.id);
      const previousColumnIndex = previousIndexById.get(columnLocation.id);
      if (previousRowIndex === undefined || previousColumnIndex === undefined) {
        return null;
      }
      return previousMatrix[previousRowIndex]?.[previousColumnIndex] ?? null;
    }),
  );
}
