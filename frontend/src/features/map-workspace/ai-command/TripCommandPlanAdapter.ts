import type {
  TripCommandPlanOperation,
  TripCommandPlanStepId,
} from '@trasolve/shared';
import { createTripPlaceFromGooglePlace } from '@/entities/place';
import type { TripCommand } from '@/features/map-workspace/command/TripCommand';
import {
  createAddDayCommandWithPendingId,
  createAddPlaceCommandWithPendingId,
  createMoveDayCommand,
  createMovePlaceCommand,
  createRemovePlaceCommand,
  createRenameDayCommand,
  createRenamePlaceCommand,
  createRenameTripCommand,
  createUpdateMemoCommand,
  createUpdatePreferredDurationCommand,
  createUpdatePolylineModeCommand,
  createUpdateVisitTimeRangeCommand,
  type PlaceInput,
} from '@/features/map-workspace/command/tripCommands';
import { TripCommandPlanError } from '@/features/map-workspace/ai-command/TripCommandPlanError';
import { lookupTripCommandPlanPlace } from '@/features/map-workspace/ai-command/TripCommandPlanPlaceLookup';
import {
  requireWorkingDay,
  requireWorkingPlace,
  requireWorkingPolyline,
  resolveTripCommandPlanDay,
  resolveTripCommandPlanDayPosition,
  resolveTripCommandPlanPlace,
  resolveTripCommandPlanPlacePosition,
  resolveTripCommandPlanPolyline,
  type TripCommandPlanResolutionContext,
  type TripCommandPlanResultBinding,
  type TripCommandPlanResultKind,
} from '@/features/map-workspace/ai-command/TripCommandPlanResolver';

export type AdaptedTripCommandPlanOperation = {
  commands: readonly TripCommand[];
  result?: TripCommandPlanResultBinding;
};

export async function adaptTripCommandPlanOperation(
  operation: TripCommandPlanOperation,
  context: TripCommandPlanResolutionContext,
  signal?: AbortSignal,
): Promise<AdaptedTripCommandPlanOperation> {
  switch (operation.op) {
    case 'rename_trip':
      return { commands: [createRenameTripCommand(operation.title)] };
    case 'add_day': {
      const id = createPendingEntityId();
      return {
        commands: [createAddDayCommandWithPendingId(operation.title, id)],
        result: { kind: 'day', id },
      };
    }
    case 'rename_day': {
      const dayId = resolveTripCommandPlanDay(operation.day, context);
      requireWorkingDay(context.workingTrip, dayId, operation.stepId);
      return {
        commands: [createRenameDayCommand(dayId, operation.title)],
      };
    }
    case 'move_day': {
      const dayId = resolveTripCommandPlanDay(operation.day, context);
      requireWorkingDay(context.workingTrip, dayId, operation.stepId);
      const targetIndex = resolveTripCommandPlanDayPosition(
        operation.position,
        context.workingTrip,
        operation.stepId,
      );
      return { commands: [createMoveDayCommand(dayId, targetIndex)] };
    }
    case 'add_place': {
      const dayId = resolveTripCommandPlanDay(operation.day, context);
      const day = requireWorkingDay(
        context.workingTrip,
        dayId,
        operation.stepId,
      );
      const details = await lookupTripCommandPlanPlace(
        operation.source,
        operation.stepId,
        signal,
      );
      const input: PlaceInput = {
        ...createTripPlaceFromGooglePlace(details),
        ...(operation.time === undefined ? {} : { time: operation.time }),
        ...(operation.visitDurationMinutes === undefined
          ? {}
          : { visitDurationMinutes: operation.visitDurationMinutes }),
        ...(operation.preferredDurationMinutes === undefined
          ? {}
          : { preferredDurationMinutes: operation.preferredDurationMinutes }),
        ...(operation.memo === undefined ? {} : { memo: operation.memo }),
      };
      const id = createPendingEntityId();
      const commands: TripCommand[] = [
        createAddPlaceCommandWithPendingId(dayId, input, id),
      ];
      if (operation.position) {
        commands.push(
          createMovePlaceCommand(
            id,
            dayId,
            resolveTripCommandPlanPlacePosition(
              operation.position,
              day.places.length + 1,
              operation.stepId,
            ),
          ),
        );
      }
      return { commands, result: { kind: 'place', id } };
    }
    case 'remove_place': {
      const placeId = resolveTripCommandPlanPlace(operation.place, context);
      requireWorkingPlace(context.workingTrip, placeId, operation.stepId);
      return { commands: [createRemovePlaceCommand(placeId)] };
    }
    case 'move_place': {
      const placeId = resolveTripCommandPlanPlace(operation.place, context);
      const dayId = resolveTripCommandPlanDay(operation.day, context);
      requireWorkingPlace(context.workingTrip, placeId, operation.stepId);
      const targetDay = requireWorkingDay(
        context.workingTrip,
        dayId,
        operation.stepId,
      );
      const sourceDay = context.workingTrip.days.find((day) =>
        day.places.some((place) => place.id === placeId),
      )!;
      const finalPlaceCount =
        targetDay.places.length + (sourceDay.id === targetDay.id ? 0 : 1);
      const targetIndex = resolveTripCommandPlanPlacePosition(
        operation.position,
        finalPlaceCount,
        operation.stepId,
      );
      return {
        commands: [createMovePlaceCommand(placeId, dayId, targetIndex)],
      };
    }
    case 'rename_place': {
      const placeId = resolveTripCommandPlanPlace(operation.place, context);
      requireWorkingPlace(context.workingTrip, placeId, operation.stepId);
      return {
        commands: [createRenamePlaceCommand(placeId, operation.name)],
      };
    }
    case 'set_memo': {
      const placeId = resolveTripCommandPlanPlace(operation.place, context);
      requireWorkingPlace(context.workingTrip, placeId, operation.stepId);
      return { commands: [createUpdateMemoCommand(placeId, operation.memo)] };
    }
    case 'set_visit_time': {
      const placeId = resolveTripCommandPlanPlace(operation.place, context);
      const place = requireWorkingPlace(
        context.workingTrip,
        placeId,
        operation.stepId,
      );
      if (place.visitDurationMinutes === undefined) {
        throw missingVisitField(operation.stepId, '방문 소요 시간');
      }
      return {
        commands: [
          createUpdateVisitTimeRangeCommand(
            placeId,
            operation.time,
            place.visitDurationMinutes,
          ),
        ],
      };
    }
    case 'set_visit_duration': {
      const placeId = resolveTripCommandPlanPlace(operation.place, context);
      const place = requireWorkingPlace(
        context.workingTrip,
        placeId,
        operation.stepId,
      );
      if (place.time === undefined) {
        throw missingVisitField(operation.stepId, '방문 시작 시간');
      }
      return {
        commands: [
          createUpdateVisitTimeRangeCommand(
            placeId,
            place.time,
            operation.minutes,
          ),
        ],
      };
    }
    case 'set_preferred_duration': {
      const placeId = resolveTripCommandPlanPlace(operation.place, context);
      requireWorkingPlace(context.workingTrip, placeId, operation.stepId);
      return {
        commands: [
          createUpdatePreferredDurationCommand(placeId, operation.minutes),
        ],
      };
    }
    case 'set_polyline_mode': {
      const polylineId = resolveTripCommandPlanPolyline(
        operation.polyline,
        context,
      );
      requireWorkingPolyline(context.workingTrip, polylineId, operation.stepId);
      return {
        commands: [createUpdatePolylineModeCommand(polylineId, operation.mode)],
      };
    }
    default:
      return unsupportedOperation(operation);
  }
}

export function getTripCommandPlanResultKind(
  operation: TripCommandPlanOperation,
): TripCommandPlanResultKind | null {
  if (operation.op === 'add_day') {
    return 'day';
  }
  return operation.op === 'add_place' ? 'place' : null;
}

function createPendingEntityId(): string {
  return `pending-${crypto.randomUUID()}`;
}

function missingVisitField(
  stepId: TripCommandPlanStepId,
  field: string,
): TripCommandPlanError {
  return new TripCommandPlanError(
    'unsafe_operation',
    `${field}이 없는 장소는 기존 값을 보존해 변경할 수 없습니다.`,
    stepId,
  );
}

function unsupportedOperation(operation: never): never {
  const value = operation as { stepId?: string };
  throw new TripCommandPlanError(
    'unsupported_operation',
    '지원하지 않는 여행 명령입니다.',
    value.stepId,
  );
}
