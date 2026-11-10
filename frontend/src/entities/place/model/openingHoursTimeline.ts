import type { PlaceOpeningHoursPeriod } from '@trasolve/shared';
import { formatClockTime } from '@/entities/place/model/clockFormat';
import {
  type PlaceOpeningTimeline,
  type LocalClock,
  type PlaceOpeningTimelineRange,
} from '@/entities/place/model/openingHoursTypes';
import {
  MINUTES_PER_DAY,
  MINUTES_PER_WEEK,
  getPointDayOffset,
  getPeriodDuration,
} from '@/entities/place/model/openingHoursClock';

export function getTodayTimelineRanges(
  periods: readonly PlaceOpeningHoursPeriod[],
  clock: LocalClock,
) {
  const ranges: PlaceOpeningTimelineRange[] = [];

  for (const period of periods) {
    if (!period.close) {
      continue;
    }
    const duration = getPeriodDuration(period);
    if (duration === undefined) {
      continue;
    }

    const startOfDay =
      getPointDayOffset(period.open, clock) * MINUTES_PER_DAY +
      period.open.hour * 60 +
      period.open.minute;
    const weekOffsets = period.open.date
      ? [0]
      : [-MINUTES_PER_WEEK, 0, MINUTES_PER_WEEK];

    for (const weekOffset of weekOffsets) {
      const start = startOfDay + weekOffset;
      const end = start + duration;
      if (start >= MINUTES_PER_DAY || end <= 0) {
        continue;
      }
      const visibleStart = Math.max(0, start);
      const visibleEnd = Math.min(MINUTES_PER_DAY, end);
      ranges.push({
        start,
        end,
        startText: formatClockTime(visibleStart),
        endText: formatClockTime(visibleEnd, { endOfDay: true }),
      });
    }
  }

  return ranges.sort((left, right) => left.start - right.start);
}

export function getOpeningTimeline(
  ranges: readonly PlaceOpeningTimelineRange[],
  clock: LocalClock,
  state: PlaceOpeningTimeline['state'],
): PlaceOpeningTimeline | undefined {
  const now = clock.hour * 60 + clock.minute;
  let range: PlaceOpeningTimelineRange | undefined;

  if (state === 'open' || state === 'closing-soon') {
    range = ranges.find(({ start, end }) => start <= now && now < end);
  } else if (state === 'before-open') {
    range = ranges.find(({ start }) => start > now);
  } else {
    range = [...ranges].reverse().find(({ end }) => end <= now);
  }

  if (!range) {
    return undefined;
  }
  const progress =
    state === 'open' || state === 'closing-soon'
      ? ((now - range.start) / (range.end - range.start)) * 100
      : undefined;

  return {
    startText: range.startText,
    endText: range.endText,
    state,
    progress,
  };
}
