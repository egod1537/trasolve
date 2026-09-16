import type { PlaceDetails } from '@trasolve/shared';
import {
  MIN_VISIT_DURATION_MINUTES,
  VISIT_TIME_GRANULARITY_MINUTES,
} from '../../../map/domain/timeGranularity';
import { getPlaceOpeningStatus } from '../../../map/domain/placeOpeningHours';

export const DEFAULT_OPEN_TIME = '09:00';
export const DEFAULT_CLOSE_TIME = '18:00';
export const DEFAULT_STAY_MINUTES = 60;
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
}

export type JobBuilderLocationErrors = Partial<
  Record<'openTime' | 'closeTime' | 'stayMinutes', string>
>;

export interface JobBuilderValidation {
  valid: boolean;
  messages: string[];
  locationErrors: Record<string, JobBuilderLocationErrors>;
  startTimeError?: string;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function isVisitTime(value: string, googleTime?: string): boolean {
  if (!TIME_PATTERN.test(value)) {
    return false;
  }
  return (
    value === googleTime ||
    Number(value.slice(3)) % VISIT_TIME_GRANULARITY_MINUTES === 0
  );
}

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

export function createInitialJobBuilderState(): JobBuilderState {
  return {
    locations: [],
    startTime: '09:00',
  };
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
    sourceIndex <= 0 ||
    sourceIndex >= locations.length - 1 ||
    targetIndex <= 0 ||
    targetIndex >= locations.length - 1 ||
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

export function validateJobBuilder(
  state: JobBuilderState,
): JobBuilderValidation {
  const messages: string[] = [];
  const locationErrors: Record<string, JobBuilderLocationErrors> = {};
  const ids = new Set<string>();

  if (state.locations.length < 2) {
    messages.push('출발지와 도착지를 포함해 장소가 2개 이상 필요합니다.');
  }

  for (const location of state.locations) {
    const errors: JobBuilderLocationErrors = {};
    if (!location.id.trim() || ids.has(location.id)) {
      messages.push('위치 ID는 비어 있지 않고 서로 달라야 합니다.');
    }
    ids.add(location.id);
    if (!location.placeId.trim()) {
      messages.push(`${location.name}: place_id가 필요합니다.`);
    }
    if (
      !isVisitTime(location.openTime, location.googleOpeningWindow?.openTime)
    ) {
      errors.openTime = `영업 시작 시각을 ${VISIT_TIME_GRANULARITY_MINUTES}분 단위로 입력하세요.`;
    }
    if (
      !isVisitTime(location.closeTime, location.googleOpeningWindow?.closeTime)
    ) {
      errors.closeTime = `영업 종료 시각을 ${VISIT_TIME_GRANULARITY_MINUTES}분 단위로 입력하세요.`;
    }
    if (
      !errors.openTime &&
      !errors.closeTime &&
      location.openTime > location.closeTime
    ) {
      errors.closeTime = '종료 시각은 시작 시각보다 빠를 수 없습니다.';
    }
    if (
      !Number.isInteger(location.stayMinutes) ||
      location.stayMinutes < MIN_VISIT_DURATION_MINUTES ||
      location.stayMinutes > MAX_STAY_MINUTES ||
      location.stayMinutes % VISIT_TIME_GRANULARITY_MINUTES !== 0
    ) {
      errors.stayMinutes = `${MIN_VISIT_DURATION_MINUTES}~${MAX_STAY_MINUTES}분 사이에서 ${VISIT_TIME_GRANULARITY_MINUTES}분 단위로 입력하세요.`;
    }
    if (Object.keys(errors).length > 0) {
      locationErrors[location.id] = errors;
    }
  }

  const startTimeError = isVisitTime(state.startTime)
    ? undefined
    : `시작 시각을 ${VISIT_TIME_GRANULARITY_MINUTES}분 단위로 입력하세요.`;

  if (startTimeError) {
    messages.push(startTimeError);
  }
  if (Object.keys(locationErrors).length > 0) {
    messages.push('위치별 입력값을 확인하세요.');
  }

  return {
    valid: messages.length === 0,
    messages: [...new Set(messages)],
    locationErrors,
    ...(startTimeError ? { startTimeError } : {}),
  };
}
