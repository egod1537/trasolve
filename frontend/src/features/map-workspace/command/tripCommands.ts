import {
  tripIdSchema,
  type PlaceStyle,
  type Trip,
  type TripPlace,
  type TripPolyline,
  type TripPolylineMode,
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
  return defineTripCommand((trip) =>
    addDay(trip, title, `pending-${crypto.randomUUID()}`),
  );
}

export function createAddDayCommandWithPendingId(
  title: string,
  pendingId: string,
): TripCommand {
  const id = readPendingId(pendingId);
  return defineTripCommand((trip) => addDay(trip, title, id));
}

function addDay(trip: Trip, title: string, id: string): Trip {
  return {
    ...trip,
    days: [
      ...trip.days,
      {
        id,
        title,
        color: '#2563eb',
        places: [],
        polylines: [],
        layerItems: [],
      },
    ],
  };
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
  return createAddPlaceCommandWithIdFactory(
    dayId,
    input,
    () => `pending-${crypto.randomUUID()}`,
  );
}

export function createAddPlaceCommandWithPendingId(
  dayId: string,
  input: PlaceInput,
  pendingId: string,
): TripCommand {
  const id = readPendingId(pendingId);
  return createAddPlaceCommandWithIdFactory(dayId, input, () => id);
}

function createAddPlaceCommandWithIdFactory(
  dayId: string,
  input: PlaceInput,
  createId: () => string,
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
      id: createId(),
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

export function createReorderDayPlacesCommand(
  dayId: string,
  placeIds: readonly string[],
): TripCommand {
  const orderedIds = [...placeIds];
  return defineTripCommand((trip) => {
    const day = trip.days.find((candidate) => candidate.id === dayId);
    if (!day) {
      throw new Error('순서를 변경할 날짜를 찾을 수 없습니다.');
    }
    const uniqueIds = new Set(orderedIds);
    const currentIds = new Set(day.places.map((place) => place.id));
    const currentStartId = day.places[0]?.id;
    const currentDestinationId = day.places.at(-1)?.id;
    if (
      orderedIds.length !== day.places.length ||
      uniqueIds.size !== orderedIds.length ||
      orderedIds.some((placeId) => !currentIds.has(placeId)) ||
      orderedIds[0] !== currentStartId ||
      orderedIds.at(-1) !== currentDestinationId
    ) {
      throw new Error(
        '최적화 결과의 장소 순서가 현재 Day와 일치하지 않습니다.',
      );
    }
    const placesById = new Map(day.places.map((place) => [place.id, place]));
    day.places = orderedIds.map((placeId) => placesById.get(placeId)!);
    return trip;
  });
}

export function createUpdatePlaceCommand(
  placeId: string,
  patch: Partial<PlaceInput>,
): TripCommand {
  return createPlacePatchCommand(placeId, patch);
}

export function createRenamePlaceCommand(
  placeId: string,
  name: string,
): TripCommand {
  return createPlacePatchCommand(placeId, { name });
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

function readPendingId(value: string): string {
  const parsed = tripIdSchema.safeParse(value);
  if (!parsed.success || !parsed.data.startsWith('pending-')) {
    throw new Error('새 여행 항목 ID가 올바르지 않습니다.');
  }
  return parsed.data;
}
