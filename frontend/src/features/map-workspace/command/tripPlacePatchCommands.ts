import {
  type PlaceStyle,
  type Trip,
  type TripPlace,
  type TripPolyline,
  type TripPolylineMode,
} from '@trasolve/shared';
import {
  defineTripCommand,
  type TripCommand,
} from '@/features/map-workspace/command/TripCommand';
import { L } from '@/shared/i18n';
import { type PlaceInput } from '@/features/map-workspace/command/tripCommandTypes';

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

export function createPlacePatchCommand(
  placeId: string,
  patch: Partial<PlaceInput>,
): TripCommand {
  const placePatch = synchronizePlaceDurations(structuredClone(patch));
  return defineTripCommand((trip) => {
    Object.assign(findPlace(trip, placeId), placePatch);
    return trip;
  });
}

export function synchronizePlaceDurations(
  patch: Partial<PlaceInput>,
): Partial<PlaceInput> {
  const durationMinutes =
    patch.preferredDurationMinutes ?? patch.visitDurationMinutes;
  if (durationMinutes === undefined) {
    return patch;
  }
  return {
    ...patch,
    visitDurationMinutes: durationMinutes,
    preferredDurationMinutes: durationMinutes,
  };
}

export function findPlace(trip: Trip, placeId: string): TripPlace {
  const place = trip.days
    .flatMap((day) => day.places)
    .find((candidate) => candidate.id === placeId);
  if (!place) {
    throw new Error(L('map:tripCommands.error.locationNotFound'));
  }
  return place;
}

export function findPolyline(trip: Trip, polylineId: string): TripPolyline {
  const polyline = trip.days
    .flatMap((day) => day.polylines)
    .find((item) => item.id === polylineId);
  if (!polyline) {
    throw new Error(L('map:tripCommands.error.connectorNotFound'));
  }
  return polyline;
}
