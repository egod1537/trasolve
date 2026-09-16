import {
  TRIP_PLACE_MAX_DURATION_MINUTES,
  tripIdSchema,
} from '@trasolve/shared';
import type { TripCommand } from './TripCommand';
import {
  createMoveDayCommand,
  createMovePlaceCommand,
  createRemovePlaceCommand,
  createRenameDayCommand,
  createRenameTripCommand,
  createUpdateMemoCommand,
  createUpdatePreferredDurationCommand,
  createUpdateVisitTimeRangeCommand,
} from './tripCommands';

export type RegisteredTripCommand =
  { type: 'command'; command: TripCommand } | { type: 'undo' | 'redo' };

export type TripCommandRegistryResult =
  | {
      success: true;
      commandName: string;
      operation: RegisteredTripCommand;
    }
  | { success: false; commandName: string; error: string };

type TripCommandDefinition = {
  argumentCount: number;
  create: (args: readonly string[]) => RegisteredTripCommand;
};

class TripCommandArgumentError extends Error {}

const clockTimePattern = /^([01]\d|2[0-3]):[0-5]\d$/u;

const commandRegistry: ReadonlyMap<string, TripCommandDefinition> = new Map([
  [
    'rename_trip',
    defineCommand(1, ([title]) => ({
      type: 'command',
      command: createRenameTripCommand(readTitle(title, 'title')),
    })),
  ],
  [
    'rename_day',
    defineCommand(2, ([dayId, title]) => ({
      type: 'command',
      command: createRenameDayCommand(
        readId(dayId, 'dayId'),
        readTitle(title, 'title'),
      ),
    })),
  ],
  [
    'move_day',
    defineCommand(2, ([dayId, targetIndex]) => ({
      type: 'command',
      command: createMoveDayCommand(
        readId(dayId, 'dayId'),
        readNonNegativeInteger(targetIndex, 'targetIndex'),
      ),
    })),
  ],
  [
    'remove_place',
    defineCommand(1, ([placeId]) => ({
      type: 'command',
      command: createRemovePlaceCommand(readId(placeId, 'placeId')),
    })),
  ],
  [
    'move_place',
    defineCommand(3, ([placeId, targetDayId, targetIndex]) => ({
      type: 'command',
      command: createMovePlaceCommand(
        readId(placeId, 'placeId'),
        readId(targetDayId, 'targetDayId'),
        readNonNegativeInteger(targetIndex, 'targetIndex'),
      ),
    })),
  ],
  [
    'set_visit_time',
    defineCommand(3, ([placeId, time, visitDurationMinutes]) => ({
      type: 'command',
      command: createUpdateVisitTimeRangeCommand(
        readId(placeId, 'placeId'),
        readClockTime(time),
        readDuration(visitDurationMinutes, 'visitDurationMinutes'),
      ),
    })),
  ],
  [
    'set_stay_duration',
    defineCommand(2, ([placeId, preferredDurationMinutes]) => ({
      type: 'command',
      command: createUpdatePreferredDurationCommand(
        readId(placeId, 'placeId'),
        readDuration(preferredDurationMinutes, 'preferredDurationMinutes'),
      ),
    })),
  ],
  [
    'set_memo',
    defineCommand(2, ([placeId, memo]) => ({
      type: 'command',
      command: createUpdateMemoCommand(
        readId(placeId, 'placeId'),
        readMemo(memo),
      ),
    })),
  ],
  ['undo', defineCommand(0, () => ({ type: 'undo' }))],
  ['redo', defineCommand(0, () => ({ type: 'redo' }))],
]);

export function createRegisteredTripCommand(
  commandName: string,
  args: readonly string[],
): TripCommandRegistryResult {
  const definition = commandRegistry.get(commandName);
  if (!definition) {
    return {
      success: false,
      commandName,
      error: `지원하지 않는 명령입니다: /${commandName}`,
    };
  }
  if (args.length !== definition.argumentCount) {
    return {
      success: false,
      commandName,
      error: `/${commandName} 명령에는 ${definition.argumentCount}개의 인자가 필요합니다. 전달된 인자: ${args.length}개`,
    };
  }

  try {
    return {
      success: true,
      commandName,
      operation: definition.create(args),
    };
  } catch (cause) {
    return {
      success: false,
      commandName,
      error:
        cause instanceof TripCommandArgumentError
          ? cause.message
          : `/${commandName} 명령의 인자를 해석할 수 없습니다.`,
    };
  }
}

function defineCommand(
  argumentCount: number,
  create: TripCommandDefinition['create'],
): TripCommandDefinition {
  return { argumentCount, create };
}

function readId(value: string | undefined, name: string): string {
  const parsed = tripIdSchema.safeParse(value);
  if (!parsed.success) {
    throw new TripCommandArgumentError(
      `${name}은(는) 영문, 숫자, 하이픈, 밑줄로 구성된 유효한 ID여야 합니다.`,
    );
  }
  return parsed.data;
}

function readTitle(value: string | undefined, name: string): string {
  const title = value?.trim() ?? '';
  if (!title || title.length > 200) {
    throw new TripCommandArgumentError(
      `${name}은(는) 1자 이상 200자 이하의 문자열이어야 합니다.`,
    );
  }
  return title;
}

function readMemo(value: string | undefined): string {
  const memo = value ?? '';
  if (memo.length > 4000) {
    throw new TripCommandArgumentError(
      'memo는 4000자 이하의 문자열이어야 합니다.',
    );
  }
  return memo;
}

function readNonNegativeInteger(
  value: string | undefined,
  name: string,
): number {
  if (!value || !/^\d+$/u.test(value)) {
    throw new TripCommandArgumentError(
      `${name}은(는) 0 이상의 정수여야 합니다.`,
    );
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new TripCommandArgumentError(
      `${name}은(는) 안전한 정수 범위여야 합니다.`,
    );
  }
  return parsed;
}

function readDuration(value: string | undefined, name: string): number {
  const duration = readNonNegativeInteger(value, name);
  if (duration > TRIP_PLACE_MAX_DURATION_MINUTES) {
    throw new TripCommandArgumentError(
      `${name}은(는) ${TRIP_PLACE_MAX_DURATION_MINUTES} 이하여야 합니다.`,
    );
  }
  return duration;
}

function readClockTime(value: string | undefined): string {
  if (!value || !clockTimePattern.test(value)) {
    throw new TripCommandArgumentError(
      '방문 시간은 HH:MM 형식의 유효한 24시간 값이어야 합니다.',
    );
  }
  return value;
}
