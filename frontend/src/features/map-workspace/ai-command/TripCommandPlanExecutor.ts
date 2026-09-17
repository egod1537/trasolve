import {
  reconcileDayRouteSegments,
  tripCommandPlanSchema,
  tripSchema,
  type Trip,
  type TripCommandPlan,
  type TripCommandPlanStepId,
  type TripCommandPlanValidationError,
} from '@trasolve/shared';
import type { TripCommand } from '@/features/map-workspace/command/TripCommand';
import { defineTripCommand } from '@/features/map-workspace/command/TripCommand';
import type { TripEditController } from '@/features/map-workspace/controller/TripEditController';
import {
  adaptTripCommandPlanOperation,
  getTripCommandPlanResultKind,
} from '@/features/map-workspace/ai-command/TripCommandPlanAdapter';
import {
  normalizeTripCommandPlanError,
  TripCommandPlanError,
} from '@/features/map-workspace/ai-command/TripCommandPlanError';
import {
  createTripCommandPlanFingerprint,
  serializeTripCommandPlanState,
} from '@/features/map-workspace/ai-command/TripCommandPlanFingerprint';
import {
  computeTripCommandPlanDiff,
  type TripCommandPlanDiffEntry,
} from '@/features/map-workspace/ai-command/TripCommandPlanDiff';
import {
  computeTripCommandPlanRisk,
  type TripCommandPlanRisk,
} from '@/features/map-workspace/ai-command/TripCommandPlanRisk';
import type {
  TripCommandPlanResultBinding,
  TripCommandPlanResultKind,
} from '@/features/map-workspace/ai-command/TripCommandPlanResolver';

/**
 * Deterministic preview of what a prepared plan would change, computed from
 * the same before/after Trip states the preflight already produces. No
 * model reasoning, natural-language reconstruction, or generic patch format
 * is involved (see TripCommandPlanDiff / TripCommandPlanRisk).
 */
export type TripCommandPlanPreview = Readonly<{
  before: Trip;
  after: Trip;
  diff: readonly TripCommandPlanDiffEntry[];
  risk: TripCommandPlanRisk;
}>;

export type PreparedTripCommandPlan = Readonly<{
  tripId: string;
  fingerprint: string;
  operationCount: number;
  confirmationRequired: null;
  commands: readonly TripCommand[];
  baseState: string;
  preview: TripCommandPlanPreview;
}>;

export type PrepareTripCommandPlanResult =
  | { success: true; prepared: PreparedTripCommandPlan }
  | { success: false; error: TripCommandPlanValidationError };

export type ExecutePreparedTripCommandPlanResult =
  { success: true } | { success: false; error: TripCommandPlanValidationError };

export type PrepareTripCommandPlanOptions = {
  selectedPlaceIds?: readonly string[];
  signal?: AbortSignal;
};

const supportedOperations = new Set([
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

export async function prepareTripCommandPlan(
  input: unknown,
  currentTrip: Trip,
  options: PrepareTripCommandPlanOptions = {},
): Promise<PrepareTripCommandPlanResult> {
  const unsupported = findUnsupportedOperation(input);
  if (unsupported) {
    return {
      success: false,
      error: {
        code: 'unsupported_operation',
        message: '지원하지 않는 여행 명령이 포함되어 있습니다.',
      },
    };
  }

  const parsed = tripCommandPlanSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: 'schema_invalid',
        message: '여행 명령 계획 형식이 올바르지 않습니다.',
      },
    };
  }

  const plan = parsed.data;
  try {
    const initialTrip = tripSchema.parse(structuredClone(currentTrip));
    await validateBase(plan, initialTrip);
    const selectedPlaceIds = validateSelection(
      options.selectedPlaceIds ?? [],
      initialTrip,
    );
    const stepIndexes = createStepIndexes(plan);
    const stepResultKinds = new Map<
      TripCommandPlanStepId,
      TripCommandPlanResultKind | null
    >(
      plan.operations.map((operation) => [
        operation.stepId,
        getTripCommandPlanResultKind(operation),
      ]),
    );
    const results = new Map<
      TripCommandPlanStepId,
      TripCommandPlanResultBinding
    >();
    const commands: TripCommand[] = [];
    let workingTrip = structuredClone(initialTrip);

    for (const [stepIndex, operation] of plan.operations.entries()) {
      const adapted = await adaptTripCommandPlanOperation(
        operation,
        {
          initialTrip,
          workingTrip,
          selectedPlaceIds,
          stepIndexes,
          stepResultKinds,
          results,
          stepIndex,
          stepId: operation.stepId,
        },
        options.signal,
      );
      for (const command of adapted.commands) {
        workingTrip = applyCommandForPreflight(workingTrip, command);
        commands.push(command);
      }
      if (adapted.result) {
        results.set(operation.stepId, adapted.result);
      }
    }

    const baseState = serializeTripCommandPlanState(initialTrip);
    const diff = computeTripCommandPlanDiff(initialTrip, workingTrip);
    const risk = computeTripCommandPlanRisk(plan);
    return {
      success: true,
      prepared: Object.freeze({
        tripId: plan.base.tripId,
        fingerprint: plan.base.fingerprint,
        operationCount: plan.operations.length,
        confirmationRequired: null,
        commands: Object.freeze([
          createBaseStateGuardCommand(baseState),
          ...commands,
        ]),
        baseState,
        preview: Object.freeze({
          before: initialTrip,
          after: workingTrip,
          diff: Object.freeze(diff),
          risk,
        }),
      }),
    };
  } catch (cause) {
    return {
      success: false,
      error: normalizeTripCommandPlanError(cause),
    };
  }
}

export async function executePreparedTripCommandPlan(
  prepared: PreparedTripCommandPlan,
  currentTrip: Trip,
  controller: TripEditController,
): Promise<ExecutePreparedTripCommandPlanResult> {
  if (
    currentTrip.id !== prepared.tripId ||
    serializeTripCommandPlanState(currentTrip) !== prepared.baseState
  ) {
    return {
      success: false,
      error: {
        code: 'stale_plan',
        message: '여행이 계획 준비 이후 변경되었습니다.',
      },
    };
  }

  const success = await controller.executeBatch(prepared.commands);
  return success
    ? { success: true }
    : {
        success: false,
        error: {
          code: 'unsafe_operation',
          message: '준비된 여행 명령을 안전하게 실행할 수 없습니다.',
        },
      };
}

async function validateBase(plan: TripCommandPlan, trip: Trip): Promise<void> {
  if (plan.base.tripId !== trip.id) {
    throw new TripCommandPlanError(
      'stale_plan',
      '여행 명령 계획이 현재 여행을 대상으로 하지 않습니다.',
    );
  }
  if (
    plan.base.fingerprint !== (await createTripCommandPlanFingerprint(trip))
  ) {
    throw new TripCommandPlanError(
      'stale_plan',
      '여행이 명령 계획을 만든 이후 변경되었습니다.',
    );
  }
}

function validateSelection(
  selectedPlaceIds: readonly string[],
  trip: Trip,
): readonly string[] {
  if (new Set(selectedPlaceIds).size !== selectedPlaceIds.length) {
    throw new TripCommandPlanError(
      'unsafe_operation',
      '선택된 장소 목록에 중복 ID가 있습니다.',
    );
  }
  const placeIds = new Set(
    trip.days.flatMap((day) => day.places.map((place) => place.id)),
  );
  if (selectedPlaceIds.some((placeId) => !placeIds.has(placeId))) {
    throw new TripCommandPlanError(
      'unresolved_target',
      '선택된 장소 중 현재 여행에 없는 항목이 있습니다.',
    );
  }
  return Object.freeze([...selectedPlaceIds]);
}

function createStepIndexes(
  plan: TripCommandPlan,
): ReadonlyMap<TripCommandPlanStepId, number> {
  const indexes = new Map<TripCommandPlanStepId, number>();
  for (const [index, operation] of plan.operations.entries()) {
    if (indexes.has(operation.stepId)) {
      throw new TripCommandPlanError(
        'unsafe_operation',
        '여행 명령 계획의 단계 ID가 중복되었습니다.',
        operation.stepId,
      );
    }
    indexes.set(operation.stepId, index);
  }
  return indexes;
}

function applyCommandForPreflight(trip: Trip, command: TripCommand): Trip {
  const next = command.apply(trip);
  for (const day of next.days) {
    reconcileDayRouteSegments(day, () => `pending-${crypto.randomUUID()}`);
  }
  return tripSchema.parse(next);
}

function createBaseStateGuardCommand(baseState: string): TripCommand {
  return defineTripCommand((trip) => {
    if (serializeTripCommandPlanState(trip) !== baseState) {
      throw new Error('Stale Trip command plan.');
    }
    return trip;
  });
}

function findUnsupportedOperation(input: unknown): string | null {
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
