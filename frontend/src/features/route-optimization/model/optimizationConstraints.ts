import { type TripDay, type TripPlace } from '@trasolve/shared';
import { getPlaceOpeningStatus } from '@/entities/place';
import {
  type LocationConstraint,
  type RouteOptimizationIssue,
} from '@/features/route-optimization/model/routeOptimizationTypes';
import {
  MINUTES_PER_DAY,
  TROUTE_TIME_STEP_MINUTES,
  isClockTime,
  isTenMinuteClock,
  isTenMinuteStep,
  clockToMinutes,
} from '@/features/route-optimization/model/optimizationClock';

export const FALLBACK_OPEN_TIME = '00:00';

export const FALLBACK_CLOSE_TIME = '23:50';

export function getLocationConstraint(
  activeDay: TripDay,
  place: TripPlace,
): LocationConstraint {
  const openingWindow = getOpeningWindow(
    place,
    getReferenceDate(activeDay, place),
  );
  const stayMinutes = getOptimizationStayMinutes(place);
  const stayIssue: RouteOptimizationIssue | null = isTenMinuteStep(stayMinutes)
    ? null
    : {
        code: 'stayStep',
        values: { name: place.name, stayMinutes },
      };
  return {
    ...openingWindow,
    stayMinutes,
    issue: openingWindow.issue ?? stayIssue,
  };
}

export function getOptimizationStayMinutes(place: TripPlace): number {
  return Math.max(
    TROUTE_TIME_STEP_MINUTES,
    place.preferredDurationMinutes ??
      place.visitDurationMinutes ??
      TROUTE_TIME_STEP_MINUTES,
  );
}

export function getOpeningWindow(
  place: TripPlace,
  referenceDate: Date,
): Omit<LocationConstraint, 'stayMinutes'> {
  const status = getPlaceOpeningStatus(place.openingHours, referenceDate);
  if (status.type === 'unknown') {
    return {
      openTime: FALLBACK_OPEN_TIME,
      closeTime: FALLBACK_CLOSE_TIME,
      usedOpeningHoursFallback: true,
      issue: null,
    };
  }
  if (status.type === 'always-open') {
    return {
      openTime: FALLBACK_OPEN_TIME,
      closeTime: FALLBACK_CLOSE_TIME,
      usedOpeningHoursFallback: false,
      issue: null,
    };
  }
  if (
    status.timelineRanges.some(
      (range) => range.start < 0 || range.end >= MINUTES_PER_DAY,
    )
  ) {
    return invalidOpeningWindow({
      code: 'nextDayOpeningHours',
      values: { name: place.name },
    });
  }

  const ranges = status.timelineRanges.filter(
    (range) =>
      range.start >= 0 &&
      range.end <= MINUTES_PER_DAY &&
      range.start < range.end &&
      isClockTime(range.startText) &&
      isClockTime(range.endText),
  );
  if (ranges.length === 0) {
    return invalidOpeningWindow({
      code: 'noOpeningHours',
      values: { name: place.name },
    });
  }

  const scheduledMinutes = place.time ? clockToMinutes(place.time) : undefined;
  const range =
    ranges.find(
      (candidate) =>
        scheduledMinutes !== undefined &&
        candidate.start <= scheduledMinutes &&
        scheduledMinutes <= candidate.end,
    ) ?? ranges[0]!;
  if (!isTenMinuteClock(range.startText)) {
    return invalidOpeningWindow({
      code: 'openingTimeStep',
      values: { name: place.name, startText: range.startText },
    });
  }
  if (!isTenMinuteClock(range.endText)) {
    return invalidOpeningWindow({
      code: 'closingTimeStep',
      values: { name: place.name, endText: range.endText },
    });
  }
  return {
    openTime: range.startText,
    closeTime: range.endText,
    usedOpeningHoursFallback: false,
    issue: null,
  };
}

export function invalidOpeningWindow(
  issue: RouteOptimizationIssue,
): Omit<LocationConstraint, 'stayMinutes'> {
  return {
    openTime: FALLBACK_OPEN_TIME,
    closeTime: FALLBACK_CLOSE_TIME,
    usedOpeningHoursFallback: false,
    issue,
  };
}

export function getReferenceDate(activeDay: TripDay, place: TripPlace): Date {
  if (!activeDay.date) {
    return new Date();
  }
  const [year, month, day] = activeDay.date.split('-').map(Number);
  const utcNoon = Date.UTC(year!, month! - 1, day!, 12);
  const offsetMinutes = place.openingHours?.utcOffsetMinutes;
  return offsetMinutes === undefined
    ? new Date(`${activeDay.date}T12:00:00`)
    : new Date(utcNoon - offsetMinutes * 60_000);
}
