import type {
  Trip,
  TripCommandPlanDayPosition,
  TripCommandPlanDayReference,
  TripCommandPlanPlacePosition,
  TripCommandPlanPlaceReference,
  TripCommandPlanPolylineReference,
  TripCommandPlanStepId,
  TripPlace,
} from '@trasolve/shared';
import { TripCommandPlanError } from '@/features/map-workspace/ai-command/TripCommandPlanError';
import { L } from '@/shared/i18n';

export type TripCommandPlanResultKind = 'day' | 'place';

export type TripCommandPlanResultBinding = {
  kind: TripCommandPlanResultKind;
  id: string;
};

export type TripCommandPlanResolutionContext = {
  initialTrip: Trip;
  workingTrip: Trip;
  selectedPlaceIds: readonly string[];
  stepIndexes: ReadonlyMap<TripCommandPlanStepId, number>;
  stepResultKinds: ReadonlyMap<
    TripCommandPlanStepId,
    TripCommandPlanResultKind | null
  >;
  results: ReadonlyMap<TripCommandPlanStepId, TripCommandPlanResultBinding>;
  stepIndex: number;
  stepId: TripCommandPlanStepId;
};

export function resolveTripCommandPlanDay(
  reference: TripCommandPlanDayReference,
  context: TripCommandPlanResolutionContext,
): string {
  if (reference.kind === 'result') {
    return resolveResult(reference.stepId, 'day', context);
  }

  const day =
    reference.kind === 'id'
      ? context.initialTrip.days.find(
          (candidate) => candidate.id === reference.id,
        )
      : context.initialTrip.days[reference.ordinal - 1];
  if (!day) {
    throw unresolved(
      context.stepId,
      L('map:tripCommandPlanResolver.error.dateTargetNotFound'),
    );
  }
  return day.id;
}

export function resolveTripCommandPlanPlace(
  reference: TripCommandPlanPlaceReference,
  context: TripCommandPlanResolutionContext,
): string {
  if (reference.kind === 'result') {
    return resolveResult(reference.stepId, 'place', context);
  }

  if (reference.kind === 'selection') {
    const selectedId = context.selectedPlaceIds[reference.ordinal - 1];
    if (!selectedId || !findPlace(context.initialTrip, selectedId)) {
      throw unresolved(
        context.stepId,
        L(
          'map:tripCommandPlanResolver.error.selectedLocationDestinationCannotBeFound',
        ),
      );
    }
    return selectedId;
  }

  if (reference.kind === 'id') {
    if (!findPlace(context.initialTrip, reference.id)) {
      throw unresolved(
        context.stepId,
        L('map:tripCommandPlanResolver.error.locationDestinationNotFound'),
      );
    }
    return reference.id;
  }

  const scopedDayId = reference.day
    ? resolveTripCommandPlanDay(reference.day, context)
    : null;
  const normalizedName = normalizePlaceName(reference.name);
  const matches = context.initialTrip.days.flatMap((day) =>
    scopedDayId && day.id !== scopedDayId
      ? []
      : day.places.filter(
          (place) => normalizePlaceName(place.name) === normalizedName,
        ),
  );
  if (matches.length === 0) {
    throw unresolved(
      context.stepId,
      L('map:tripCommandPlanResolver.error.noPlaceFoundMatchingName'),
    );
  }
  if (matches.length > 1) {
    throw new TripCommandPlanError(
      'ambiguous_target',
      L('map:tripCommandPlanResolver.error.thereMultiplePlacesMatchingNames'),
      context.stepId,
    );
  }
  return matches[0].id;
}

export function resolveTripCommandPlanPolyline(
  reference: TripCommandPlanPolylineReference,
  context: TripCommandPlanResolutionContext,
): string {
  const exists = context.initialTrip.days.some((day) =>
    day.polylines.some((polyline) => polyline.id === reference.id),
  );
  if (!exists) {
    throw unresolved(
      context.stepId,
      L('map:tripCommandPlanResolver.error.connectorTargetNotFound'),
    );
  }
  return reference.id;
}

export function resolveTripCommandPlanDayPosition(
  position: TripCommandPlanDayPosition,
  trip: Trip,
  stepId: TripCommandPlanStepId,
): number {
  if (trip.days.length === 0) {
    throw unresolved(
      stepId,
      L('map:tripCommandPlanResolver.error.unableDetermineOrderDatesMove'),
    );
  }
  if (position.kind === 'start') {
    return 0;
  }
  if (position.kind === 'end') {
    return trip.days.length - 1;
  }
  if (position.ordinal > trip.days.length) {
    throw unresolved(
      stepId,
      L(
        'map:tripCommandPlanResolver.error.requestedDateSequenceOutsideCurrentTravel',
      ),
    );
  }
  return position.ordinal - 1;
}

export function resolveTripCommandPlanPlacePosition(
  position: TripCommandPlanPlacePosition,
  finalPlaceCount: number,
  stepId: TripCommandPlanStepId,
): number {
  if (finalPlaceCount < 1) {
    throw unresolved(
      stepId,
      L('map:tripCommandPlanResolver.error.iCanTDecideWhichOrder'),
    );
  }
  if (position.kind === 'start') {
    return 0;
  }
  if (position.kind === 'end') {
    return finalPlaceCount - 1;
  }
  if (position.ordinal > finalPlaceCount) {
    throw unresolved(
      stepId,
      L(
        'map:tripCommandPlanResolver.error.requestedPlaceSequenceOutsideCurrentDate',
      ),
    );
  }
  return position.ordinal - 1;
}

export function requireWorkingDay(
  trip: Trip,
  dayId: string,
  stepId: TripCommandPlanStepId,
) {
  const day = trip.days.find((candidate) => candidate.id === dayId);
  if (!day) {
    throw unresolved(
      stepId,
      L('map:tripCommandPlanResolver.error.dateDestinationDoesNotExistCurrent'),
    );
  }
  return day;
}

export function requireWorkingPlace(
  trip: Trip,
  placeId: string,
  stepId: TripCommandPlanStepId,
): TripPlace {
  const place = findPlace(trip, placeId);
  if (!place) {
    throw unresolved(
      stepId,
      L(
        'map:tripCommandPlanResolver.error.locationDestinationDoesNotCurrentlyExist',
      ),
    );
  }
  return place;
}

export function requireWorkingPolyline(
  trip: Trip,
  polylineId: string,
  stepId: TripCommandPlanStepId,
): void {
  const exists = trip.days.some((day) =>
    day.polylines.some((polyline) => polyline.id === polylineId),
  );
  if (!exists) {
    throw unresolved(
      stepId,
      L(
        'map:tripCommandPlanResolver.error.connectorDestinationDoesNotExistCurrent',
      ),
    );
  }
}

function resolveResult(
  resultStepId: TripCommandPlanStepId,
  expectedKind: TripCommandPlanResultKind,
  context: TripCommandPlanResolutionContext,
): string {
  const resultStepIndex = context.stepIndexes.get(resultStepId);
  if (resultStepIndex === undefined) {
    throw unresolved(
      context.stepId,
      L('map:tripCommandPlanResolver.error.previousStepReferencedDoesNotExist'),
    );
  }
  if (resultStepIndex >= context.stepIndex) {
    throw new TripCommandPlanError(
      'unsafe_operation',
      L('map:tripCommandPlanResolver.error.currentStepCannotReferLaterSteps'),
      context.stepId,
    );
  }
  if (context.stepResultKinds.get(resultStepId) !== expectedKind) {
    throw new TripCommandPlanError(
      'unsafe_operation',
      L('map:tripCommandPlanResolver.error.resultingFormatFromPreviousStepNot'),
      context.stepId,
    );
  }

  const result = context.results.get(resultStepId);
  if (!result || result.kind !== expectedKind) {
    throw unresolved(
      context.stepId,
      L('map:tripCommandPlanResolver.error.previousStepResultsNotAvailable'),
    );
  }
  return result.id;
}

function findPlace(trip: Trip, placeId: string): TripPlace | undefined {
  return trip.days
    .flatMap((day) => day.places)
    .find((place) => place.id === placeId);
}

function normalizePlaceName(value: string): string {
  return value.normalize('NFC').trim().toLowerCase();
}

function unresolved(
  stepId: TripCommandPlanStepId,
  message: string,
): TripCommandPlanError {
  return new TripCommandPlanError('unresolved_target', message, stepId);
}
