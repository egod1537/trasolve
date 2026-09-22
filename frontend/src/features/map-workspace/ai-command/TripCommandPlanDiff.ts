import type {
  Trip,
  TripDay,
  TripPlace,
  TripPolylineMode,
} from '@trasolve/shared';

/**
 * Narrow, entity-ID-based diff entries for the mutation families a
 * TripCommandPlan can produce. Deliberately not a generic JSON Patch or
 * property-path format: each entry names the semantic field that changed so
 * a future confirmation UI can render "before → after" without knowing
 * Trip internals.
 */
export type TripCommandPlanDiffEntry =
  | { op: 'rename_trip'; before: string; after: string }
  | { op: 'add_day'; dayId: string; title: string; index: number }
  | { op: 'rename_day'; dayId: string; before: string; after: string }
  | {
      op: 'move_day';
      dayId: string;
      beforeIndex: number;
      afterIndex: number;
    }
  | {
      op: 'add_place';
      placeId: string;
      dayId: string;
      index: number;
      name: string;
    }
  | {
      op: 'remove_place';
      placeId: string;
      dayId: string;
      index: number;
      name: string;
    }
  | {
      op: 'move_place';
      placeId: string;
      beforeDayId: string;
      beforeIndex: number;
      afterDayId: string;
      afterIndex: number;
    }
  | { op: 'rename_place'; placeId: string; before: string; after: string }
  | {
      op: 'set_memo';
      placeId: string;
      before: string | undefined;
      after: string | undefined;
    }
  | {
      op: 'set_visit_time';
      placeId: string;
      before: string | undefined;
      after: string | undefined;
    }
  | {
      op: 'set_visit_duration';
      placeId: string;
      before: number | undefined;
      after: number | undefined;
    }
  | {
      op: 'set_preferred_duration';
      placeId: string;
      before: number | undefined;
      after: number | undefined;
    }
  | {
      op: 'set_polyline_mode';
      polylineId: string;
      before: TripPolylineMode;
      after: TripPolylineMode;
    };

type PlaceLocation = { day: TripDay; place: TripPlace; index: number };

/**
 * Computes the semantic diff between two Trip states produced by the same
 * deterministic preflight path (see TripCommandPlanExecutor). Both `before`
 * and `after` are assumed to be already-resolved, schema-valid Trip
 * snapshots; this function performs no resolution, network lookups, or
 * model involvement of its own.
 */
export function computeTripCommandPlanDiff(
  before: Trip,
  after: Trip,
): TripCommandPlanDiffEntry[] {
  const entries: TripCommandPlanDiffEntry[] = [];

  if (before.title !== after.title) {
    entries.push({
      op: 'rename_trip',
      before: before.title,
      after: after.title,
    });
  }

  entries.push(...diffDays(before, after));
  entries.push(...diffPlaces(before, after));
  entries.push(...diffPolylineModes(before, after));

  return entries;
}

function diffDays(before: Trip, after: Trip): TripCommandPlanDiffEntry[] {
  const entries: TripCommandPlanDiffEntry[] = [];
  const beforeById = new Map(
    before.days.map((day, index) => [day.id, { day, index }]),
  );

  after.days.forEach((day, afterIndex) => {
    const beforeEntry = beforeById.get(day.id);
    if (!beforeEntry) {
      entries.push({
        op: 'add_day',
        dayId: day.id,
        title: day.title,
        index: afterIndex,
      });
      return;
    }
    if (beforeEntry.day.title !== day.title) {
      entries.push({
        op: 'rename_day',
        dayId: day.id,
        before: beforeEntry.day.title,
        after: day.title,
      });
    }
    if (beforeEntry.index !== afterIndex) {
      entries.push({
        op: 'move_day',
        dayId: day.id,
        beforeIndex: beforeEntry.index,
        afterIndex,
      });
    }
  });

  return entries;
}

function diffPlaces(before: Trip, after: Trip): TripCommandPlanDiffEntry[] {
  const entries: TripCommandPlanDiffEntry[] = [];
  const beforePlaces = collectPlaces(before);
  const afterPlaces = collectPlaces(after);

  for (const [placeId, afterLocation] of afterPlaces) {
    const beforeLocation = beforePlaces.get(placeId);
    if (!beforeLocation) {
      entries.push({
        op: 'add_place',
        placeId,
        dayId: afterLocation.day.id,
        index: afterLocation.index,
        name: afterLocation.place.name,
      });
      continue;
    }
    entries.push(...diffExistingPlace(placeId, beforeLocation, afterLocation));
  }

  for (const [placeId, beforeLocation] of beforePlaces) {
    if (!afterPlaces.has(placeId)) {
      entries.push({
        op: 'remove_place',
        placeId,
        dayId: beforeLocation.day.id,
        index: beforeLocation.index,
        name: beforeLocation.place.name,
      });
    }
  }

  return entries;
}

function diffExistingPlace(
  placeId: string,
  beforeLocation: PlaceLocation,
  afterLocation: PlaceLocation,
): TripCommandPlanDiffEntry[] {
  const entries: TripCommandPlanDiffEntry[] = [];
  const beforePlace = beforeLocation.place;
  const afterPlace = afterLocation.place;

  if (beforePlace.name !== afterPlace.name) {
    entries.push({
      op: 'rename_place',
      placeId,
      before: beforePlace.name,
      after: afterPlace.name,
    });
  }
  if (
    beforeLocation.day.id !== afterLocation.day.id ||
    beforeLocation.index !== afterLocation.index
  ) {
    entries.push({
      op: 'move_place',
      placeId,
      beforeDayId: beforeLocation.day.id,
      beforeIndex: beforeLocation.index,
      afterDayId: afterLocation.day.id,
      afterIndex: afterLocation.index,
    });
  }
  if (beforePlace.memo !== afterPlace.memo) {
    entries.push({
      op: 'set_memo',
      placeId,
      before: beforePlace.memo,
      after: afterPlace.memo,
    });
  }
  if (beforePlace.time !== afterPlace.time) {
    entries.push({
      op: 'set_visit_time',
      placeId,
      before: beforePlace.time,
      after: afterPlace.time,
    });
  }
  if (beforePlace.visitDurationMinutes !== afterPlace.visitDurationMinutes) {
    entries.push({
      op: 'set_visit_duration',
      placeId,
      before: beforePlace.visitDurationMinutes,
      after: afterPlace.visitDurationMinutes,
    });
  }
  if (
    beforePlace.preferredDurationMinutes !== afterPlace.preferredDurationMinutes
  ) {
    entries.push({
      op: 'set_preferred_duration',
      placeId,
      before: beforePlace.preferredDurationMinutes,
      after: afterPlace.preferredDurationMinutes,
    });
  }

  return entries;
}

function diffPolylineModes(
  before: Trip,
  after: Trip,
): TripCommandPlanDiffEntry[] {
  const entries: TripCommandPlanDiffEntry[] = [];
  const beforePolylines = collectPolylines(before);
  const afterPolylines = collectPolylines(after);

  for (const [polylineId, afterMode] of afterPolylines) {
    const beforeMode = beforePolylines.get(polylineId);
    if (beforeMode !== undefined && beforeMode !== afterMode) {
      entries.push({
        op: 'set_polyline_mode',
        polylineId,
        before: beforeMode,
        after: afterMode,
      });
    }
  }

  return entries;
}

function collectPlaces(trip: Trip): Map<string, PlaceLocation> {
  const locations = new Map<string, PlaceLocation>();
  for (const day of trip.days) {
    day.places.forEach((place, index) => {
      locations.set(place.id, { day, place, index });
    });
  }
  return locations;
}

function collectPolylines(trip: Trip): Map<string, TripPolylineMode> {
  const modes = new Map<string, TripPolylineMode>();
  for (const day of trip.days) {
    for (const polyline of day.polylines) {
      modes.set(polyline.id, polyline.mode);
    }
  }
  return modes;
}
