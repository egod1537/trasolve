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
    throw unresolved(context.stepId, '날짜 대상을 찾을 수 없습니다.');
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
      throw unresolved(context.stepId, '선택된 장소 대상을 찾을 수 없습니다.');
    }
    return selectedId;
  }

  if (reference.kind === 'id') {
    if (!findPlace(context.initialTrip, reference.id)) {
      throw unresolved(context.stepId, '장소 대상을 찾을 수 없습니다.');
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
      '이름이 일치하는 장소를 찾을 수 없습니다.',
    );
  }
  if (matches.length > 1) {
    throw new TripCommandPlanError(
      'ambiguous_target',
      '이름이 일치하는 장소가 여러 개입니다.',
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
    throw unresolved(context.stepId, '연결선 대상을 찾을 수 없습니다.');
  }
  return reference.id;
}

export function resolveTripCommandPlanDayPosition(
  position: TripCommandPlanDayPosition,
  trip: Trip,
  stepId: TripCommandPlanStepId,
): number {
  if (trip.days.length === 0) {
    throw unresolved(stepId, '이동할 날짜 순서를 결정할 수 없습니다.');
  }
  if (position.kind === 'start') {
    return 0;
  }
  if (position.kind === 'end') {
    return trip.days.length - 1;
  }
  if (position.ordinal > trip.days.length) {
    throw unresolved(stepId, '요청한 날짜 순서가 현재 여행 범위를 벗어납니다.');
  }
  return position.ordinal - 1;
}

export function resolveTripCommandPlanPlacePosition(
  position: TripCommandPlanPlacePosition,
  finalPlaceCount: number,
  stepId: TripCommandPlanStepId,
): number {
  if (finalPlaceCount < 1) {
    throw unresolved(stepId, '이동할 장소 순서를 결정할 수 없습니다.');
  }
  if (position.kind === 'start') {
    return 0;
  }
  if (position.kind === 'end') {
    return finalPlaceCount - 1;
  }
  if (position.ordinal > finalPlaceCount) {
    throw unresolved(stepId, '요청한 장소 순서가 현재 날짜 범위를 벗어납니다.');
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
    throw unresolved(stepId, '날짜 대상이 현재 여행에 존재하지 않습니다.');
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
    throw unresolved(stepId, '장소 대상이 현재 여행에 존재하지 않습니다.');
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
    throw unresolved(stepId, '연결선 대상이 현재 여행에 존재하지 않습니다.');
  }
}

function resolveResult(
  resultStepId: TripCommandPlanStepId,
  expectedKind: TripCommandPlanResultKind,
  context: TripCommandPlanResolutionContext,
): string {
  const resultStepIndex = context.stepIndexes.get(resultStepId);
  if (resultStepIndex === undefined) {
    throw unresolved(context.stepId, '참조한 이전 단계가 존재하지 않습니다.');
  }
  if (resultStepIndex >= context.stepIndex) {
    throw new TripCommandPlanError(
      'unsafe_operation',
      '현재 단계는 이후 단계나 자기 자신을 참조할 수 없습니다.',
      context.stepId,
    );
  }
  if (context.stepResultKinds.get(resultStepId) !== expectedKind) {
    throw new TripCommandPlanError(
      'unsafe_operation',
      '이전 단계의 결과 형식이 현재 대상과 호환되지 않습니다.',
      context.stepId,
    );
  }

  const result = context.results.get(resultStepId);
  if (!result || result.kind !== expectedKind) {
    throw unresolved(context.stepId, '이전 단계 결과를 사용할 수 없습니다.');
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
