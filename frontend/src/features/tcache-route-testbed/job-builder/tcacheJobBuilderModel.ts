import type { PlaceDetails } from '@trasolve/shared';
import type {
  TcacheRouteLocation,
  TcacheRouteMode,
  TcacheRouteRequest,
} from '@/features/tcache-route-testbed/model/types';
import type { GeoPoint } from '@/shared/types/mapTypes';

export const MAX_TCACHE_LOCATIONS = 27;

export interface TcacheRouteLocationDraft extends TcacheRouteLocation {
  name: string;
}

export interface TcacheJobBuilderState {
  locations: TcacheRouteLocationDraft[];
  mode: TcacheRouteMode;
  departureTimeLocal: string;
  computeAlternativeRoutes: boolean;
  languageCode: string;
  regionCode: string;
}

export interface TcacheJobBuilderValidation {
  valid: boolean;
  messages: string[];
  locationErrors: Record<string, string>;
}

export function createTcacheJobBuilderDraft(): TcacheJobBuilderState {
  const now = new Date(Date.now() + 60 * 60 * 1_000);
  now.setMinutes(Math.ceil(now.getMinutes() / 10) * 10, 0, 0);
  return {
    locations: [createEmptyLocation(), createEmptyLocation()],
    mode: 'TRANSIT',
    departureTimeLocal: formatLocalDateTime(now),
    computeAlternativeRoutes: false,
    languageCode: 'ko',
    regionCode: 'KR',
  };
}

export function createTcacheLocationFromPlace(
  place: PlaceDetails,
): TcacheRouteLocationDraft {
  return {
    id: `tcache-location-${crypto.randomUUID()}`,
    name: place.name,
    placeId: place.id,
    ...(place.address ? { address: place.address } : {}),
    lat: place.location.lat,
    lng: place.location.lng,
  };
}

export function createEmptyLocation(): TcacheRouteLocationDraft {
  return {
    id: `tcache-location-${crypto.randomUUID()}`,
    name: '',
  };
}

export function createTcacheLocationFromCoordinate(
  point: GeoPoint,
): TcacheRouteLocationDraft {
  return {
    id: `tcache-location-${crypto.randomUUID()}`,
    name: `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`,
    lat: point.lat,
    lng: point.lng,
  };
}

export function addTcacheLocation(
  locations: readonly TcacheRouteLocationDraft[],
  location: TcacheRouteLocationDraft,
): TcacheRouteLocationDraft[] {
  if (locations.length >= MAX_TCACHE_LOCATIONS) {
    return [...locations];
  }
  if (locations.length < 2) {
    return [...locations, location];
  }
  return [...locations.slice(0, -1), location, locations.at(-1)!];
}

export function reorderTcacheLocations(
  locations: readonly TcacheRouteLocationDraft[],
  locationId: string,
  targetIndex: number,
): TcacheRouteLocationDraft[] {
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
  if (moved) {
    next.splice(targetIndex, 0, moved);
  }
  return next;
}

export function validateTcacheJobBuilder(
  state: TcacheJobBuilderState,
): TcacheJobBuilderValidation {
  const messages: string[] = [];
  const locationErrors: Record<string, string> = {};
  if (state.locations.length < 2) {
    messages.push('출발지와 도착지를 포함해 위치가 2개 이상 필요합니다.');
  }
  if (state.locations.length > MAX_TCACHE_LOCATIONS) {
    messages.push(
      `위치는 최대 ${MAX_TCACHE_LOCATIONS}개까지 추가할 수 있습니다.`,
    );
  }
  const placeIds = new Set<string>();
  state.locations.forEach((location) => {
    const hasCoordinates =
      Number.isFinite(location.lat) && Number.isFinite(location.lng);
    if (!location.placeId && !location.address?.trim() && !hasCoordinates) {
      locationErrors[location.id] = '장소 검색으로 위치를 선택해 주세요.';
    }
    if (location.placeId) {
      if (placeIds.has(location.placeId)) {
        locationErrors[location.id] = '같은 Place ID가 중복되었습니다.';
      }
      placeIds.add(location.placeId);
    }
  });
  if (Object.keys(locationErrors).length > 0) {
    messages.push('유효하지 않은 위치를 확인해 주세요.');
  }
  if (!toOffsetIsoString(state.departureTimeLocal)) {
    messages.push('유효한 출발 날짜와 시각을 입력해 주세요.');
  }
  if (!state.languageCode.trim()) {
    messages.push('languageCode를 입력해 주세요.');
  }
  return { valid: messages.length === 0, messages, locationErrors };
}

export function tcacheJobBuilderToRequest(
  state: TcacheJobBuilderState,
): TcacheRouteRequest | null {
  const departureTime = toOffsetIsoString(state.departureTimeLocal);
  if (!departureTime) {
    return null;
  }
  return {
    locations: state.locations.map((location) => ({ ...location })),
    mode: state.mode,
    departureTime,
    computeAlternativeRoutes: state.computeAlternativeRoutes,
    languageCode: state.languageCode.trim(),
    ...(state.regionCode.trim() ? { regionCode: state.regionCode.trim() } : {}),
  };
}

export function toOffsetIsoString(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const [, year, month, day, hour, minute] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
    0,
  );
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day) ||
    date.getHours() !== Number(hour) ||
    date.getMinutes() !== Number(minute)
  ) {
    return null;
  }
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteOffset = Math.abs(offsetMinutes);
  return `${value}:00${sign}${pad(Math.floor(absoluteOffset / 60))}:${pad(absoluteOffset % 60)}`;
}

function formatLocalDateTime(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
