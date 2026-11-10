import type {
  PlaceOpeningHours,
  PlaceOpeningHoursPeriod,
  PlaceOpeningHoursPoint,
  PlaceOpeningSchedule,
} from '@trasolve/shared';
import { type LocalClock } from '@/entities/place/model/openingHoursTypes';

export const MINUTES_PER_DAY = 24 * 60;

export const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

export function getParts(
  date: Date,
  hours: PlaceOpeningHours,
): LocalClock | null {
  if (hours.timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
        timeZone: hours.timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(date);
      const values = Object.fromEntries(
        parts.map((part) => [part.type, Number(part.value)]),
      );
      const year = values.year,
        month = values.month,
        day = values.day,
        hour = values.hour,
        minute = values.minute;
      if (
        year === undefined ||
        month === undefined ||
        day === undefined ||
        hour === undefined ||
        minute === undefined
      ) {
        return null;
      }
      return {
        year,
        month,
        day,
        weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
        hour,
        minute,
      };
    } catch {
      // Fall back to a validated offset when an unknown IANA zone is supplied.
    }
  }

  if (hours.utcOffsetMinutes === undefined) {
    return null;
  }
  const shifted = new Date(date.getTime() + hours.utcOffsetMinutes * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

export function calendarDay(clock: Pick<LocalClock, 'year' | 'month' | 'day'>) {
  return Math.floor(
    Date.UTC(clock.year, clock.month - 1, clock.day) / 86_400_000,
  );
}

export function getPointDayOffset(
  point: PlaceOpeningHoursPoint,
  clock: LocalClock,
) {
  return point.date
    ? calendarDay(point.date) - calendarDay(clock)
    : point.day - clock.weekday;
}

export function getPeriodDuration(period: PlaceOpeningHoursPeriod) {
  if (!period.close) {
    return undefined;
  }

  const openMinutes = period.open.hour * 60 + period.open.minute;
  const closeMinutes = period.close.hour * 60 + period.close.minute;
  if (period.open.date && period.close.date) {
    const dayDifference =
      calendarDay(period.close.date) - calendarDay(period.open.date);
    const duration =
      dayDifference * MINUTES_PER_DAY + closeMinutes - openMinutes;
    return duration > 0 ? duration : undefined;
  }

  const openWeekMinutes = period.open.day * MINUTES_PER_DAY + openMinutes;
  const closeWeekMinutes = period.close.day * MINUTES_PER_DAY + closeMinutes;
  const duration =
    (closeWeekMinutes - openWeekMinutes + MINUTES_PER_WEEK) % MINUTES_PER_WEEK;
  return duration > 0 ? duration : MINUTES_PER_WEEK;
}

export function matchesDay(point: PlaceOpeningHoursPoint, clock: LocalClock) {
  return point.date
    ? point.date.year === clock.year &&
        point.date.month === clock.month &&
        point.date.day === clock.day
    : point.day === clock.weekday;
}

export function isSamePointDay(
  left: PlaceOpeningHoursPoint,
  right: PlaceOpeningHoursPoint,
) {
  if (left.date && right.date) {
    return (
      left.date.year === right.date.year &&
      left.date.month === right.date.month &&
      left.date.day === right.date.day
    );
  }
  return left.day === right.day;
}

export function isAlwaysOpen(schedule?: PlaceOpeningSchedule) {
  const periods = schedule?.periods;
  return (
    periods?.length === 1 &&
    periods[0].open.day === 0 &&
    periods[0].open.hour === 0 &&
    periods[0].open.minute === 0 &&
    periods[0].close === undefined
  );
}

export function minutesUntil(timestamp: string | undefined, now: Date) {
  if (!timestamp) {
    return undefined;
  }
  const target = Date.parse(timestamp);
  if (!Number.isFinite(target) || target < now.getTime()) {
    return undefined;
  }
  return (target - now.getTime()) / 60_000;
}
