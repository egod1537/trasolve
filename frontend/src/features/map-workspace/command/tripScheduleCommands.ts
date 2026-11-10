import { type TripScheduleUpdate } from '@trasolve/shared';
import {
  defineTripCommand,
  type TripCommand,
} from '@/features/map-workspace/command/TripCommand';
import { L } from '@/shared/i18n';

export function createApplyOptimizedScheduleCommand(
  dayId: string,
  schedule: TripScheduleUpdate,
): TripCommand {
  const update = structuredClone(schedule);
  return defineTripCommand((trip) => {
    const day = trip.days.find((candidate) => candidate.id === dayId);
    if (!day) {
      throw new Error(
        L('map:tripCommands.error.dateWhichScheduleAppliesCannotBe'),
      );
    }
    const currentIds = new Set(day.places.map((place) => place.id));
    const orderedIds = update.placeIds;
    const uniqueOrderedIds = new Set(orderedIds);
    const skippedIds = update.skippedPlaceIds ?? [];
    const uniqueSkippedIds = new Set(skippedIds);
    const partial = skippedIds.length > 0;
    const stopsById = new Map(update.stops.map((stop) => [stop.placeId, stop]));
    if (
      (partial
        ? orderedIds.length + skippedIds.length !== day.places.length ||
          uniqueSkippedIds.size !== skippedIds.length ||
          skippedIds.some(
            (placeId) =>
              !currentIds.has(placeId) || uniqueOrderedIds.has(placeId),
          )
        : orderedIds.length !== day.places.length) ||
      uniqueOrderedIds.size !== orderedIds.length ||
      orderedIds.some((placeId) => !currentIds.has(placeId)) ||
      update.stops.length !== orderedIds.length ||
      stopsById.size !== update.stops.length ||
      orderedIds.some((placeId) => !stopsById.has(placeId)) ||
      orderedIds[0] !== update.expectedStartPlaceId ||
      orderedIds.at(-1) !== update.expectedEndPlaceId ||
      !currentIds.has(update.expectedStartPlaceId) ||
      !currentIds.has(update.expectedEndPlaceId)
    ) {
      throw new Error(
        L('map:tripCommands.error.locationStartEndPointOptimizationSchedule'),
      );
    }

    const placesById = new Map(day.places.map((place) => [place.id, place]));
    day.places = orderedIds.map((placeId) => {
      const place = placesById.get(placeId)!;
      const stop = stopsById.get(placeId)!;
      const durationMinutes =
        stop.visitDurationMinutes ??
        place.preferredDurationMinutes ??
        place.visitDurationMinutes;
      return {
        ...place,
        time: stop.time,
        visitDurationMinutes: durationMinutes,
        preferredDurationMinutes: durationMinutes,
      };
    });
    return trip;
  });
}
