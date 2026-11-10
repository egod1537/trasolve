import {
  reconcileDayRouteSegments,
  tripCommandPlanSchema,
  tripSchema,
  type Trip,
  type TripCommandPlanStepId,
  type TripCommandPlanValidationError,
} from '@trasolve/shared';
import type { TripCommand } from '@/features/map-workspace/command/TripCommand';
import { defineTripCommand } from '@/features/map-workspace/command/TripCommand';
import type {
  PersistedBatchOutcome,
  TripEditController,
} from '@/features/map-workspace/controller/TripEditController';
import {
  adaptTripCommandPlanOperation,
  getTripCommandPlanResultKind,
} from '@/features/map-workspace/ai-command/TripCommandPlanAdapter';
import {
  normalizeTripCommandPlanError,
  TripCommandPlanError,
} from '@/features/map-workspace/ai-command/TripCommandPlanError';
import { serializeTripCommandPlanState } from '@/features/map-workspace/ai-command/TripCommandPlanFingerprint';
import {
  computeTripCommandPlanDiff,
  type TripCommandPlanDiffEntry,
} from '@/features/map-workspace/ai-command/TripCommandPlanDiff';
import {
  computeTripCommandPlanRisk,
  type TripCommandPlanRisk,
} from '@/features/map-workspace/ai-command/TripCommandPlanRisk';
import {
  resolveTripCommandPlanPlace,
  type TripCommandPlanResultBinding,
  type TripCommandPlanResultKind,
} from '@/features/map-workspace/ai-command/TripCommandPlanResolver';
import { L } from '@/shared/i18n';

/**
 * Deterministic preview of what a prepared plan would change, computed from
 * the same before/after Trip states the preflight already produces. No
 * model reasoning, natural-language reconstruction, or generic patch format
 * is involved (see TripCommandPlanDiff / TripCommandPlanRisk).
 */
import {
  validateBase,
  validateSelection,
  createStepIndexes,
  findUnsupportedOperation,
} from '@/features/map-workspace/ai-command/TripCommandPlanValidation';

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
  | { success: true }
  | {
      success: false;
      error: TripCommandPlanValidationError;
      /** Why a persisted Apply did not complete (conflict, busy, unknown...). */
      outcome?: PersistedBatchOutcome;
    };

export type PrepareTripCommandPlanOptions = {
  selectedPlaceIds?: readonly string[];
  signal?: AbortSignal;
};

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
        message: L(
          'map:tripCommandPlanExecutor.prepareTripCommandPlan.message.containsUnsupportedTravelCommands',
        ),
      },
    };
  }

  const parsed = tripCommandPlanSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: 'schema_invalid',
        message: L(
          'map:tripCommandPlanExecutor.prepareTripCommandPlan.message.travelCommandPlanFormatIncorrect',
        ),
      },
    };
  }

  const plan = parsed.data;
  try {
    options.signal?.throwIfAborted();
    const initialTrip = tripSchema.parse(structuredClone(currentTrip));
    await validateBase(plan, initialTrip);
    options.signal?.throwIfAborted();
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
    // The schema keeps visit and preferred durations in sync, so any later
    // different duration for the same resolved place would silently win.
    const durationEdits = new Map<string, number>();
    const claimDuration = (
      placeId: string,
      minutes: number,
      stepId: TripCommandPlanStepId,
    ) => {
      const previous = durationEdits.get(placeId);
      if (previous !== undefined && previous !== minutes) {
        throw new TripCommandPlanError(
          'unsafe_operation',
          L(
            'map:tripCommandPlanExecutor.executePreparedTripCommandPlan.message.preparedTravelCommandCannotBeSafely',
          ),
          stepId,
        );
      }
      durationEdits.set(placeId, minutes);
    };
    let workingTrip = structuredClone(initialTrip);

    for (const [stepIndex, operation] of plan.operations.entries()) {
      options.signal?.throwIfAborted();
      const context = {
        initialTrip,
        workingTrip,
        selectedPlaceIds,
        stepIndexes,
        stepResultKinds,
        results,
        stepIndex,
        stepId: operation.stepId,
      };
      // One add operation can explicitly request incompatible simultaneous
      // durations. Sequential edits retain the domain's last-wins behavior.
      if (
        operation.op === 'add_place' &&
        operation.visitDurationMinutes !== undefined &&
        operation.preferredDurationMinutes !== undefined &&
        operation.visitDurationMinutes !== operation.preferredDurationMinutes
      ) {
        throw new TripCommandPlanError(
          'unsafe_operation',
          L(
            'map:tripCommandPlanExecutor.executePreparedTripCommandPlan.message.preparedTravelCommandCannotBeSafely',
          ),
          operation.stepId,
        );
      }
      if (
        operation.op === 'set_visit_duration' ||
        operation.op === 'set_preferred_duration'
      ) {
        claimDuration(
          resolveTripCommandPlanPlace(operation.place, context),
          operation.minutes,
          operation.stepId,
        );
      }
      const adapted = await adaptTripCommandPlanOperation(
        operation,
        context,
        options.signal,
      );
      options.signal?.throwIfAborted();
      if (operation.op === 'add_place' && adapted.result?.kind === 'place') {
        const minutes =
          operation.visitDurationMinutes ?? operation.preferredDurationMinutes;
        if (minutes !== undefined) {
          claimDuration(adapted.result.id, minutes, operation.stepId);
        }
      }
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
  options: { persist?: boolean } = {},
): Promise<ExecutePreparedTripCommandPlanResult> {
  if (
    currentTrip.id !== prepared.tripId ||
    serializeTripCommandPlanState(currentTrip) !== prepared.baseState
  ) {
    return {
      success: false,
      error: {
        code: 'stale_plan',
        message: L(
          'map:tripCommandPlanExecutor.executePreparedTripCommandPlan.message.tripHasChangedSinceItWas',
        ),
      },
    };
  }

  if (!options.persist) {
    return (await controller.executeBatch(prepared.commands))
      ? { success: true }
      : {
          success: false,
          error: {
            code: 'unsafe_operation',
            message: L(
              'map:tripCommandPlanExecutor.executePreparedTripCommandPlan.message.preparedTravelCommandCannotBeSafely',
            ),
          },
        };
  }
  const outcome = await controller.executePersistedBatchDetailed(
    prepared.commands,
  );
  if (outcome === 'committed') {
    return { success: true };
  }
  return {
    success: false,
    outcome,
    error:
      outcome === 'conflict'
        ? {
            code: 'stale_plan',
            message: L(
              'map:tripCommandPlanExecutor.executePreparedTripCommandPlan.message.tripHasChangedSinceItWas',
            ),
          }
        : {
            code: 'unsafe_operation',
            message:
              outcome === 'not_committed' || outcome === 'unknown_commit'
                ? L('map:tripEditController.runSave.error.failedSaveTrip')
                : L(
                    'map:tripCommandPlanExecutor.executePreparedTripCommandPlan.message.preparedTravelCommandCannotBeSafely',
                  ),
          },
  };
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
