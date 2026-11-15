import type {
  PlaceOpeningHoursPeriod,
  PlaceOpeningSchedule,
} from '@trasolve/shared';
import { formatClockTime } from '@/entities/place/model/clockFormat';
import {
  type LocalClock,
  type NextOpening,
  type PlaceOpeningHoursMessages,
} from '@/entities/place/model/openingHoursTypes';
import {
  matchesDay,
  isSamePointDay,
  isAlwaysOpen,
} from '@/entities/place/model/openingHoursClock';

export function formatDuration(
  minutes: number,
  messages: PlaceOpeningHoursMessages,
) {
  const rounded = Math.max(0, Math.ceil(minutes));
  const hours = Math.floor(rounded / 60);
  const remainingMinutes = rounded % 60;
  return messages.duration(hours, remainingMinutes);
}

export function formatTodayHours(
  periods: readonly PlaceOpeningHoursPeriod[],
  clock: LocalClock,
  messages: PlaceOpeningHoursMessages,
) {
  const ranges: Array<{ start: number; text: string }> = [];
  for (const period of periods) {
    const opensToday = matchesDay(period.open, clock);
    const closesToday = period.close && matchesDay(period.close, clock);
    if (opensToday) {
      const start = period.open.hour * 60 + period.open.minute;
      if (!period.close) {
        ranges.push({
          start,
          text: messages.after(formatClockTime(period.open)),
        });
        continue;
      }
      const nextDay = !isSamePointDay(period.open, period.close);
      ranges.push({
        start,
        text: `${formatClockTime(period.open)} ~ ${nextDay ? `${messages.nextDay} ` : ''}${formatClockTime(period.close)}`,
      });
    } else if (closesToday && period.close) {
      ranges.push({
        start: 0,
        text: `${formatClockTime(0)} ~ ${formatClockTime(period.close)}`,
      });
    }
  }
  return ranges
    .sort((left, right) => left.start - right.start)
    .slice(0, 3)
    .map(({ text }) => text);
}

export function formatWeeklyHours(
  schedule: PlaceOpeningSchedule | undefined,
  messages: PlaceOpeningHoursMessages,
) {
  if (schedule?.weekdayDescriptions?.length) {
    return schedule.weekdayDescriptions;
  }
  if (!schedule?.periods) {
    return [];
  }
  if (isAlwaysOpen(schedule)) {
    return [messages.alwaysOpenWeek];
  }

  return [1, 2, 3, 4, 5, 6, 0].map((day) => {
    const ranges = schedule
      .periods!.filter((period) => !period.open.date && period.open.day === day)
      .map((period) => {
        if (!period.close) {
          return messages.after(formatClockTime(period.open));
        }
        return `${formatClockTime(period.open)} ~ ${formatClockTime(period.close)}`;
      });
    return `${messages.shortWeekdays[day]} ${ranges.length ? ranges.join(', ') : messages.closed}`;
  });
}

export function formatNextOpen(
  next: NextOpening,
  messages: PlaceOpeningHoursMessages,
) {
  const prefix =
    next.dayOffset <= 0
      ? messages.today
      : next.dayOffset === 1
        ? messages.tomorrow
        : messages.weekdays[next.point.day];
  return messages.opensAt(prefix, formatClockTime(next.point));
}
