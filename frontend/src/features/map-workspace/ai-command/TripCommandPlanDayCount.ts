import type { Trip, TripCommandPlan } from '@trasolve/shared';
import { L } from '@/shared/i18n';
import { TripCommandPlanError } from './TripCommandPlanError';
import {
  reportTripPlanDiagnostic,
  type TripPlanDiagnosticSink,
} from './TripCommandPlanDiagnostics';

type DayIntent =
  | { kind: 'TOTAL_PLAN'; total: number }
  | {
      kind: 'INCREMENTAL_ADD';
      added: number;
      describedTotal?: number;
      ordinal?: number;
    }
  | { kind: 'DAY_CONTENT_EDIT' }
  | { kind: 'AMBIGUOUS' };

/** Classify the original request only. Plan operations never establish intent. */
export function classifyTripDayIntent(request: string | undefined): DayIntent {
  const text = request?.trim() ?? '';
  const additions = [
    ...text.matchAll(
      /(?:하루|(\d+)\s*일(?!차)|Day\s*(\d+))\s*(?:을|를)?\s*(?:더\s*)?(?:추가|늘려|만들어)/giu,
    ),
  ];
  const add = additions[0];
  // Remove the increment phrase before reading a descriptive total duration.
  // "2일 더 추가" is +2, never a claim that the current Trip has two Days.
  const context = add
    ? text.slice(0, add.index) + text.slice(add.index + add[0].length)
    : text;
  const duration =
    /(?:(\d+)\s*박\s*)?(\d+)\s*일(?!차)(?:\s|여행|일정|계획|$)/u.exec(context);
  const total = duration ? Number(duration[2]) : undefined;
  const validDuration =
    total !== undefined &&
    Number.isSafeInteger(total) &&
    total > 0 &&
    total <= 20 &&
    (!duration?.[1] || Number(duration[1]) + 1 === total);
  const generation =
    /계획해\s*(?:줘|주세요)/u.test(text) ||
    /(?:계획|일정|여행|코스)\s*(?:을|를)?\s*(?:만들|짜|세워|작성|생성|추천|계획)/u.test(
      text,
    ) ||
    /(?:\d+\s*일\s*(?:여행)?|(?:여행\s*)?(?:계획|일정))\s*[.!?]?\s*$/u.test(
      text,
    );
  const content =
    /(?:제목|이름|메모|방문|체류|시간|장소|관광지|\d+\s*일차|Day\s*\d+\s*에)/iu.test(
      text,
    ) && /(?:바꿔|변경|수정|추가|옮겨|이동|설정|삭제)/u.test(text);
  if (
    additions.length > 1 ||
    (duration && !validDuration) ||
    (generation && add)
  ) {
    return { kind: 'AMBIGUOUS' };
  }
  if (add) {
    // An ordinal Day label denotes the next Day, not that many extra Days.
    const added = add[2] ? 1 : Number(add[1] ?? 1);
    if (!Number.isSafeInteger(added) || added < 1 || added > 20) {
      return { kind: 'AMBIGUOUS' };
    }
    return {
      kind: 'INCREMENTAL_ADD',
      added,
      describedTotal: total,
      ordinal: add[2] ? Number(add[2]) : undefined,
    };
  }
  if (generation && validDuration) {
    return { kind: 'TOTAL_PLAN', total };
  }
  if (content && !generation) {
    return { kind: 'DAY_CONTENT_EDIT' };
  }
  return { kind: 'AMBIGUOUS' };
}

export function validateRequestedTripDayTotal(
  plan: TripCommandPlan,
  trip: Trip,
  userRequest: string | undefined,
  onDiagnostic?: TripPlanDiagnosticSink,
): void {
  const intent = classifyTripDayIntent(userRequest);
  const additions = plan.operations.filter((op) => op.op === 'add_day').length;
  const existing = trip.days.length;
  const proposed = existing + additions;
  const expected =
    intent.kind === 'TOTAL_PLAN'
      ? intent.total
      : intent.kind === 'INCREMENTAL_ADD'
        ? existing + intent.added
        : existing;
  const valid =
    intent.kind === 'TOTAL_PLAN'
      ? proposed === expected
      : intent.kind === 'INCREMENTAL_ADD'
        ? additions === intent.added &&
          (intent.ordinal === undefined || intent.ordinal === existing + 1) &&
          (intent.describedTotal === undefined ||
            intent.describedTotal === existing)
        : intent.kind === 'DAY_CONTENT_EDIT' && additions === 0;
  if (valid) {
    return;
  }
  // Preserve the complete Plan or reject before destination/Places resolution.
  // Never delete operations, truncate existing Days, or rebind result references.
  reportTripPlanDiagnostic(onDiagnostic, {
    stage: 'plan',
    outcome: 'rejected',
    reason:
      existing === expected && additions > 0
        ? 'duplicate_days'
        : 'day_total_mismatch',
    existingDays: existing,
    addedDays: additions,
    requestedDays: expected,
    proposedDays: proposed,
  });
  throw new TripCommandPlanError(
    'unsafe_operation',
    L(
      'map:tripCommandPlanError.normalizeTripCommandPlanError.message.travelOrderPlanCannotBeSafely',
    ),
  );
}
