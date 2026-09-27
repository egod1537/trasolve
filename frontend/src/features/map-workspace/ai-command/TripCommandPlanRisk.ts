import type {
  TripCommandPlan,
  TripCommandPlanOperation,
} from '@trasolve/shared';

/**
 * Deterministic operation-characteristic labels only. This is not a
 * confirmation/UX policy: it does not decide whether a dialog appears, and
 * it is never asked of a model.
 */
export type TripCommandPlanRiskCharacteristic =
  | 'metadata_edit'
  | 'structural_change'
  | 'destructive_removal'
  | 'external_entity_resolution'
  | 'multi_operation_plan';

export type TripCommandPlanRisk = Readonly<{
  characteristics: readonly TripCommandPlanRiskCharacteristic[];
}>;

const METADATA_EDIT_OPS = new Set<TripCommandPlanOperation['op']>([
  'rename_trip',
  'rename_day',
  'rename_place',
  'set_memo',
  'set_visit_time',
  'set_visit_duration',
  'set_preferred_duration',
  'set_polyline_mode',
]);

const STRUCTURAL_OPS = new Set<TripCommandPlanOperation['op']>([
  'add_day',
  'move_day',
  'move_place',
]);

/** Derived only from the plan's own resolved operation list; no diff or Trip state needed. */
export function computeTripCommandPlanRisk(
  plan: TripCommandPlan,
): TripCommandPlanRisk {
  const characteristics = new Set<TripCommandPlanRiskCharacteristic>();

  for (const operation of plan.operations) {
    if (METADATA_EDIT_OPS.has(operation.op)) {
      characteristics.add('metadata_edit');
    }
    if (
      STRUCTURAL_OPS.has(operation.op) ||
      (operation.op === 'add_place' && operation.position !== undefined)
    ) {
      characteristics.add('structural_change');
    }
    if (operation.op === 'remove_place') {
      characteristics.add('destructive_removal');
    }
    if (operation.op === 'add_place') {
      characteristics.add('external_entity_resolution');
    }
  }

  if (plan.operations.length > 1) {
    characteristics.add('multi_operation_plan');
  }

  return Object.freeze({
    characteristics: Object.freeze([...characteristics]),
  });
}
