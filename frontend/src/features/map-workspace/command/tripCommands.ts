import type {
  PlaceStyle,
  Trip,
  TripPlace,
  TripPolyline,
  TripPolylineMode,
} from '@trasolve/shared';
import {
  DEFAULT_PLACE_PREFERRED_DURATION_MINUTES,
  DEFAULT_PLACE_START_TIME,
  DEFAULT_PLACE_VISIT_DURATION_MINUTES,
} from '@/entities/place';
import {
  defineTripCommand,
  type TripCommand,
} from '@/features/map-workspace/command/TripCommand';

export type PlaceInput = Omit<TripPlace, 'id' | 'order'>;

export function createRenameTripCommand(title: string): TripCommand {
  return defineTripCommand((trip) => ({ ...trip, title }));
}

export function createAddDayCommand(title: string): TripCommand {
  return defineTripCommand((trip) => ({
    ...trip,
    days: [
      ...trip.days,
      {
        id: `pending-${crypto.randomUUID()}`,
        title,
        color: '#2563eb',
        places: [],
        polylines: [],
        layerItems: [],
      },
    ],
  }));
}

export function createRenameDayCommand(
  dayId: string,
  title: string,
): TripCommand {
  return defineTripCommand((trip) => {
    const day = trip.days.find((candidate) => candidate.id === dayId);
    if (!day) {
      throw new Error('이름을 변경할 날짜를 찾을 수 없습니다.');
    }
    day.title = title;
    return trip;
  });
}

export function createUpdateDayColorCommand(
  dayId: string,
  color: string,
): TripCommand {
  return defineTripCommand((trip) => {
    const day = trip.days.find((candidate) => candidate.id === dayId);
    if (!day) {
      throw new Error('색상을 변경할 날짜를 찾을 수 없습니다.');
    }
    day.color = color;
    return trip;
  });
}

export function createMoveDayCommand(
  dayId: string,
  targetIndex: number,
): TripCommand {
  return defineTripCommand((trip) => {
    const sourceIndex = trip.days.findIndex((day) => day.id === dayId);
    if (sourceIndex < 0 || !Number.isInteger(targetIndex)) {
      throw new Error('이동할 날짜와 순서를 확인해 주세요.');
    }

    const [day] = trip.days.splice(sourceIndex, 1);
    trip.days.splice(
      Math.max(0, Math.min(targetIndex, trip.days.length)),
      0,
      day,
    );
    return trip;
  });
}

export function createAddPlaceCommand(
  dayId: string,
  input: PlaceInput,
): TripCommand {
  const placeInput = structuredClone(input);
  return defineTripCommand((trip) => {
    const day = trip.days.find((candidate) => candidate.id === dayId);
    if (!day) {
      throw new Error('장소를 추가할 날짜를 선택해 주세요.');
    }
    const place: TripPlace = {
      ...placeInput,
      time: placeInput.time ?? DEFAULT_PLACE_START_TIME,
      visitDurationMinutes:
        placeInput.visitDurationMinutes ?? DEFAULT_PLACE_VISIT_DURATION_MINUTES,
      preferredDurationMinutes:
        placeInput.preferredDurationMinutes ??
        DEFAULT_PLACE_PREFERRED_DURATION_MINUTES,
      id: `pending-${crypto.randomUUID()}`,
      order: day.places.length + 1,
    };
    day.places.push(place);
    day.layerItems.push({ type: 'place', id: place.id });
    return trip;
  });
}

export function createRemovePlacesCommand(
  placeIds: readonly string[],
): TripCommand {
  const uniquePlaceIds = new Set(placeIds);
  return defineTripCommand((trip) => {
    for (const placeId of uniquePlaceIds) {
      findPlace(trip, placeId);
    }
    for (const day of trip.days) {
      day.places = day.places.filter((place) => !uniquePlaceIds.has(place.id));
    }
    return trip;
  });
}

export function createRemovePlaceCommand(placeId: string): TripCommand {
  return createRemovePlacesCommand([placeId]);
}

export function createMovePlaceCommand(
  placeId: string,
  targetDayId: string,
  targetIndex: number,
): TripCommand {
  return defineTripCommand((trip) => {
    const target = trip.days.find((day) => day.id === targetDayId);
    if (!target || !Number.isInteger(targetIndex)) {
      throw new Error('이동할 날짜와 순서를 확인해 주세요.');
    }
    const source = trip.days.find((day) =>
      day.places.some((place) => place.id === placeId),
    );
    if (!source) {
      throw new Error('이동할 장소를 찾을 수 없습니다.');
    }
    const sourceIndex = source.places.findIndex(
      (place) => place.id === placeId,
    );
    const [place] = source.places.splice(sourceIndex, 1);
    const insertionIndex = Math.max(
      0,
      Math.min(targetIndex, target.places.length),
    );
    target.places.splice(insertionIndex, 0, place);
    return trip;
  });
}

export function createUpdatePlaceCommand(
  placeId: string,
  patch: Partial<PlaceInput>,
): TripCommand {
  return createPlacePatchCommand(placeId, patch);
}

export function createUpdateMemoCommand(
  placeId: string,
  memo: string,
): TripCommand {
  return createPlacePatchCommand(placeId, { memo });
}

export function createUpdateVisitTimeRangeCommand(
  placeId: string,
  time: string,
  visitDurationMinutes: number,
): TripCommand {
  return createPlacePatchCommand(placeId, { time, visitDurationMinutes });
}

export function createUpdatePreferredDurationCommand(
  placeId: string,
  preferredDurationMinutes: number,
): TripCommand {
  return createPlacePatchCommand(placeId, { preferredDurationMinutes });
}

export function createUpdatePlaceStyleCommand(
  placeId: string,
  placeStyle: PlaceStyle,
): TripCommand {
  return createPlacePatchCommand(placeId, { placeStyle });
}

export function createUpdatePolylineModesCommand(
  polylineIds: readonly string[],
  mode: TripPolylineMode,
): TripCommand {
  const uniquePolylineIds = new Set(polylineIds);
  return defineTripCommand((trip) => {
    for (const polylineId of uniquePolylineIds) {
      findPolyline(trip, polylineId).mode = mode;
    }
    return trip;
  });
}

export function createUpdatePolylineModeCommand(
  polylineId: string,
  mode: TripPolylineMode,
): TripCommand {
  return createUpdatePolylineModesCommand([polylineId], mode);
}

function createPlacePatchCommand(
  placeId: string,
  patch: Partial<PlaceInput>,
): TripCommand {
  const placePatch = structuredClone(patch);
  return defineTripCommand((trip) => {
    Object.assign(findPlace(trip, placeId), placePatch);
    return trip;
  });
}

function findPlace(trip: Trip, placeId: string): TripPlace {
  const place = trip.days
    .flatMap((day) => day.places)
    .find((candidate) => candidate.id === placeId);
  if (!place) {
    throw new Error('장소를 찾을 수 없습니다.');
  }
  return place;
}

function findPolyline(trip: Trip, polylineId: string): TripPolyline {
  const polyline = trip.days
    .flatMap((day) => day.polylines)
    .find((item) => item.id === polylineId);
  if (!polyline) {
    throw new Error('연결선을 찾을 수 없습니다.');
  }
  return polyline;
}
