import type {
  PlaceOpeningHours,
  PlaceOpeningHoursPeriod,
} from '@trasolve/shared';
import { formatClockTime } from '@/entities/place/model/clockFormat';
import {
  type PlaceOpeningStatus,
  type LocalClock,
  type NextOpening,
  type PlaceOpeningTimelineRange,
  type PlaceOpeningHoursMessages,
} from '@/entities/place/model/openingHoursTypes';
import {
  MINUTES_PER_DAY,
  MINUTES_PER_WEEK,
  getParts,
  calendarDay,
  isAlwaysOpen,
  minutesUntil,
} from '@/entities/place/model/openingHoursClock';
import {
  formatDuration,
  formatTodayHours,
  formatWeeklyHours,
  formatNextOpen,
} from '@/entities/place/model/openingHoursFormatting';
import {
  getTodayTimelineRanges,
  getOpeningTimeline,
} from '@/entities/place/model/openingHoursTimeline';
export {
  type PlaceOpeningTimeline,
  type PlaceOpeningStatus,
  type PlaceOpeningTimelineRange,
  type PlaceOpeningHoursMessages,
} from '@/entities/place/model/openingHoursTypes';

export const CLOSING_SOON_THRESHOLD_MINUTES = 60;

const EMPTY_MESSAGES: PlaceOpeningHoursMessages = {
  status: {
    open: '',
    closingSoon: '',
    closed: '',
    beforeOpen: '',
    alwaysOpen: '',
    unavailable: '',
    needsReview: '',
  },
  weekdays: ['', '', '', '', '', '', ''],
  shortWeekdays: ['', '', '', '', '', '', ''],
  today: '',
  tomorrow: '',
  nextDay: '',
  closed: '',
  alwaysOpenWeek: '',
  missingTimeZone: '',
  after: (time) => time,
  duration: (_hours, _minutes) => '',
  closesAfter: (duration) => duration,
  opensAfter: (duration) => duration,
  opensAt: (_prefix, time) => time,
};

function getWeeklyTiming(
  periods: readonly PlaceOpeningHoursPeriod[],
  clock: LocalClock,
) {
  const now = clock.weekday * MINUTES_PER_DAY + clock.hour * 60 + clock.minute;
  let open = false;
  let minutesUntilClose: number | undefined;
  let nextOpening: NextOpening | undefined;

  for (const period of periods) {
    const start =
      period.open.day * MINUTES_PER_DAY +
      period.open.hour * 60 +
      period.open.minute;
    let delta = (start - now + MINUTES_PER_WEEK) % MINUTES_PER_WEEK;
    const dayOffset = Math.floor(
      (clock.hour * 60 + clock.minute + delta) / MINUTES_PER_DAY,
    );
    if (!nextOpening || delta < nextOpening.minutes) {
      nextOpening = { minutes: delta, dayOffset, point: period.open };
    }
    if (!period.close) {
      continue;
    }

    let end =
      period.close.day * MINUTES_PER_DAY +
      period.close.hour * 60 +
      period.close.minute;
    if (end <= start) {
      end += MINUTES_PER_WEEK;
    }
    const comparableNow =
      now < start && end > MINUTES_PER_WEEK ? now + MINUTES_PER_WEEK : now;
    if (comparableNow >= start && comparableNow < end) {
      open = true;
      minutesUntilClose = end - comparableNow;
      delta = 0;
    }
  }

  return { open, minutesUntilClose, nextOpening };
}

function nextOpeningFromTimestamp(
  timestamp: string | undefined,
  hours: PlaceOpeningHours,
  now: Date,
  localNow: LocalClock,
) {
  const minutes = minutesUntil(timestamp, now);
  if (minutes === undefined || !timestamp) {
    return undefined;
  }
  const target = getParts(new Date(timestamp), hours);
  if (!target) {
    return undefined;
  }
  return {
    minutes,
    dayOffset: calendarDay(target) - calendarDay(localNow),
    point: {
      day: target.weekday,
      hour: target.hour,
      minute: target.minute,
    },
  } satisfies NextOpening;
}

export function getPlaceOpeningStatus(
  hours: PlaceOpeningHours | undefined,
  now = new Date(),
  messages: PlaceOpeningHoursMessages = EMPTY_MESSAGES,
): PlaceOpeningStatus {
  const current = hours?.current;
  const regular = hours?.regular;
  const weeklyHours = formatWeeklyHours(regular ?? current, messages);
  const base = {
    todayHours: [] as string[],
    weeklyHours,
    timelineRanges: [] as PlaceOpeningTimelineRange[],
  };

  if (!hours || (!current && !regular)) {
    return { ...base, type: 'unknown', label: messages.status.unavailable };
  }

  const localNow = getParts(now, hours);
  if (!localNow) {
    return {
      ...base,
      type: 'unknown',
      label: messages.status.needsReview,
      explanation: messages.missingTimeZone,
    };
  }

  if (isAlwaysOpen(regular)) {
    return {
      ...base,
      type: 'always-open',
      label: messages.status.alwaysOpen,
      timelineRanges: [
        {
          start: 0,
          end: MINUTES_PER_DAY,
          startText: formatClockTime(0),
          endText: formatClockTime(MINUTES_PER_DAY, { endOfDay: true }),
        },
      ],
    };
  }

  const schedule = current ?? regular;
  const periods = schedule?.periods ?? [];
  const todayHours = formatTodayHours(periods, localNow, messages);
  const timelineRanges = getTodayTimelineRanges(periods, localNow);
  const resultBase = { todayHours, weeklyHours, timelineRanges };
  const timing = getWeeklyTiming(periods, localNow);
  const openNow = schedule?.openNow ?? timing.open;

  if (openNow) {
    const closeIn =
      minutesUntil(schedule?.nextCloseTime, now) ?? timing.minutesUntilClose;
    const relativeText =
      closeIn === undefined
        ? undefined
        : messages.closesAfter(formatDuration(closeIn, messages));
    return closeIn !== undefined && closeIn <= CLOSING_SOON_THRESHOLD_MINUTES
      ? {
          ...resultBase,
          type: 'closing-soon',
          label: messages.status.closingSoon,
          relativeText,
          timeline: getOpeningTimeline(
            timelineRanges,
            localNow,
            'closing-soon',
          ),
        }
      : {
          ...resultBase,
          type: 'open',
          label: messages.status.open,
          relativeText,
          timeline: getOpeningTimeline(timelineRanges, localNow, 'open'),
        };
  }

  const next =
    nextOpeningFromTimestamp(schedule?.nextOpenTime, hours, now, localNow) ??
    timing.nextOpening;
  if (!next) {
    return {
      ...resultBase,
      type: 'closed',
      label: messages.status.closed,
      timeline: getOpeningTimeline(timelineRanges, localNow, 'closed'),
    };
  }

  const nextOpenText = formatNextOpen(next, messages);
  if (next.dayOffset === 0) {
    return {
      ...resultBase,
      type: 'before-open',
      label: messages.status.beforeOpen,
      nextOpenText,
      relativeText: messages.opensAfter(formatDuration(next.minutes, messages)),
      timeline: getOpeningTimeline(timelineRanges, localNow, 'before-open'),
    };
  }
  return {
    ...resultBase,
    type: 'closed',
    label: messages.status.closed,
    nextOpenText,
    timeline: getOpeningTimeline(timelineRanges, localNow, 'closed'),
  };
}
