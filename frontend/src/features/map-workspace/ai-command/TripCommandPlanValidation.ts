import {
  type Trip,
  type TripCommandPlan,
  type TripCommandPlanStepId,
} from '@trasolve/shared';
import { TripCommandPlanError } from '@/features/map-workspace/ai-command/TripCommandPlanError';
import { createTripCommandPlanFingerprint } from '@/features/map-workspace/ai-command/TripCommandPlanFingerprint';
import { L } from '@/shared/i18n';

/**
 * Deterministic preview of what a prepared plan would change, computed from
 * the same before/after Trip states the preflight already produces. No
 * model reasoning, natural-language reconstruction, or generic patch format
 * is involved (see TripCommandPlanDiff / TripCommandPlanRisk).
 */

export const supportedOperations = new Set([
  'rename_trip',
  'add_day',
  'rename_day',
  'move_day',
  'add_place',
  'remove_place',
  'move_place',
  'rename_place',
  'set_memo',
  'set_visit_time',
  'set_visit_duration',
  'set_preferred_duration',
  'set_polyline_mode',
]);

export async function validateBase(
  plan: TripCommandPlan,
  trip: Trip,
): Promise<void> {
  if (plan.base.tripId !== trip.id) {
    throw new TripCommandPlanError(
      'stale_plan',
      L('map:tripCommandPlanExecutor.error.travelOrderPlansDoNotCurrently'),
    );
  }
  if (
    plan.base.fingerprint !== (await createTripCommandPlanFingerprint(trip))
  ) {
    throw new TripCommandPlanError(
      'stale_plan',
      L('map:tripCommandPlanExecutor.error.tripHasChangedSinceCommandPlans'),
    );
  }
}

export function validateSelection(
  selectedPlaceIds: readonly string[],
  trip: Trip,
): readonly string[] {
  if (new Set(selectedPlaceIds).size !== selectedPlaceIds.length) {
    throw new TripCommandPlanError(
      'unsafe_operation',
      L(
        'map:tripCommandPlanExecutor.error.thereDuplicateIdsSelectedPlacesList',
      ),
    );
  }
  const placeIds = new Set(
    trip.days.flatMap((day) => day.places.map((place) => place.id)),
  );
  if (selectedPlaceIds.some((placeId) => !placeIds.has(placeId))) {
    throw new TripCommandPlanError(
      'unresolved_target',
      L(
        'map:tripCommandPlanExecutor.error.someSelectedLocationsNotCurrentlyTrip',
      ),
    );
  }
  return Object.freeze([...selectedPlaceIds]);
}

export function createStepIndexes(
  plan: TripCommandPlan,
): ReadonlyMap<TripCommandPlanStepId, number> {
  const indexes = new Map<TripCommandPlanStepId, number>();
  for (const [index, operation] of plan.operations.entries()) {
    if (indexes.has(operation.stepId)) {
      throw new TripCommandPlanError(
        'unsafe_operation',
        L(
          'map:tripCommandPlanExecutor.error.thereDuplicateStepIdTravelCommand',
        ),
        operation.stepId,
      );
    }
    indexes.set(operation.stepId, index);
  }
  return indexes;
}

export function findUnsupportedOperation(input: unknown): string | null {
  if (!input || typeof input !== 'object' || !('operations' in input)) {
    return null;
  }
  const operations = (input as { operations?: unknown }).operations;
  if (!Array.isArray(operations)) {
    return null;
  }
  for (const operation of operations) {
    if (
      operation &&
      typeof operation === 'object' &&
      'op' in operation &&
      typeof operation.op === 'string' &&
      !supportedOperations.has(operation.op)
    ) {
      return operation.op;
    }
  }
  return null;
}
