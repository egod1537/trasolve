import { type Trip, type TripPlace } from '@trasolve/shared';
import {
  DEFAULT_PLACE_PREFERRED_DURATION_MINUTES,
  DEFAULT_PLACE_START_TIME,
} from '@/entities/place';
import { pickRandomDayColor } from '@/entities/trip';
import {
  defineTripCommand,
  type TripCommand,
} from '@/features/map-workspace/command/TripCommand';
import { L } from '@/shared/i18n';
import { type PlaceInput } from '@/features/map-workspace/command/tripCommandTypes';
import { findPlace } from '@/features/map-workspace/command/tripPlacePatchCommands';
import { readPendingId } from '@/features/map-workspace/command/tripCommandIds';
export { type PlaceInput } from '@/features/map-workspace/command/tripCommandTypes';
export { createApplyOptimizedScheduleCommand } from '@/features/map-workspace/command/tripScheduleCommands';
export {
  createUpdatePlaceCommand,
  createRenamePlaceCommand,
  createUpdateMemoCommand,
  createUpdateVisitTimeRangeCommand,
  createUpdatePreferredDurationCommand,
  createUpdatePlaceStyleCommand,
  createUpdatePolylineModesCommand,
  createUpdatePolylineModeCommand,
} from '@/features/map-workspace/command/tripPlacePatchCommands';

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
  const color = pickRandomDayColor(trip.days.map((day) => day.color));
  return {
    ...trip,
    days: [
      ...trip.days,
      {
        id,
        title,
        color,
        places: [],
        polylines: [],
        layerItems: [],
      },
    ],
  };
}

/** Removing the day also removes its owned places, paths and visibility state. */
export function createRemoveDayCommand(dayId: string): TripCommand {
  return defineTripCommand((trip) => ({
    ...trip,
    days: trip.days.filter((day) => day.id !== dayId),
  }));
}

export function createRenameDayCommand(
  dayId: string,
  title: string,
): TripCommand {
  return defineTripCommand((trip) => {
    const day = trip.days.find((candidate) => candidate.id === dayId);
    if (!day) {
      throw new Error(L('map:tripCommands.error.iCanTFindDateChange'));
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
      throw new Error(L('map:tripCommands.error.iCanTFindDateChange2'));
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
      throw new Error(L('map:tripCommands.error.confirmDateOrderMovement'));
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
  options: { scheduleDefaults?: boolean } = {},
): TripCommand {
  const id = readPendingId(pendingId);
  return createAddPlaceCommandWithIdFactory(
    dayId,
    input,
    () => id,
    options.scheduleDefaults ?? true,
  );
}

function createAddPlaceCommandWithIdFactory(
  dayId: string,
  input: PlaceInput,
  createId: () => string,
  scheduleDefaults = true,
): TripCommand {
  const placeInput = structuredClone(input);
  const durationMinutes =
    placeInput.preferredDurationMinutes ??
    placeInput.visitDurationMinutes ??
    (scheduleDefaults ? DEFAULT_PLACE_PREFERRED_DURATION_MINUTES : undefined);
  const time =
    placeInput.time ??
    (scheduleDefaults ? DEFAULT_PLACE_START_TIME : undefined);
  return defineTripCommand((trip) => {
    const day = trip.days.find((candidate) => candidate.id === dayId);
    if (!day) {
      throw new Error(L('map:tripCommands.error.selectDateYouWouldLikeAdd'));
    }
    const place: TripPlace = {
      ...placeInput,
      ...(time === undefined ? {} : { time }),
      ...(durationMinutes === undefined
        ? {}
        : {
            visitDurationMinutes: durationMinutes,
            preferredDurationMinutes: durationMinutes,
          }),
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
      throw new Error(L('map:tripCommands.error.confirmDateOrderMovement'));
    }
    const source = trip.days.find((day) =>
      day.places.some((place) => place.id === placeId),
    );
    if (!source) {
      throw new Error(L('map:tripCommands.error.canTFindPlaceMove'));
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

export function createShuffleDayPlacesCommand(
  dayId: string,
  random: () => number = Math.random,
): TripCommand {
  return defineTripCommand((trip) => {
    const day = trip.days.find((candidate) => candidate.id === dayId);
    if (!day) {
      throw new Error(L('map:tripCommands.error.iCanTFindDateChange3'));
    }
    if (day.places.length < 4) {
      return trip;
    }

    const first = day.places[0]!;
    const last = day.places.at(-1)!;
    const waypoints = day.places.slice(1, -1);
    const shuffled = [...waypoints];
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

    if (shuffled.every((place, index) => place.id === waypoints[index]?.id)) {
      shuffled.push(shuffled.shift()!);
    }
    day.places = [first, ...shuffled, last];
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
      throw new Error(L('map:tripCommands.error.iCanTFindDateChange3'));
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
        L('map:tripCommands.error.orderPlacesOptimizationResultsDoesNot'),
      );
    }
    const placesById = new Map(day.places.map((place) => [place.id, place]));
    day.places = orderedIds.map((placeId) => placesById.get(placeId)!);
    return trip;
  });
}
