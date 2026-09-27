import type {
  PlaceOpeningHours,
  PlaceOpeningHoursPeriod,
  PlaceOpeningHoursPoint,
  PlaceOpeningSchedule,
} from '@trasolve/shared';
import { formatClockTime } from '@/entities/place/model/clockFormat';

export const CLOSING_SOON_THRESHOLD_MINUTES = 60;

type OpeningStatusBase = {
  todayHours: string[];
  weeklyHours: string[];
  timelineRanges: PlaceOpeningTimelineRange[];
  timeline?: PlaceOpeningTimeline;
};

export type PlaceOpeningTimeline = {
  startText: string;
  endText: string;
  state: 'open' | 'closing-soon' | 'before-open' | 'closed';
  progress?: number;
};

export type PlaceOpeningStatus =
  | (OpeningStatusBase & {
      type: 'open';
      label: string;
      relativeText?: string;
    })
  | (OpeningStatusBase & {
      type: 'closing-soon';
      label: string;
      relativeText?: string;
    })
  | (OpeningStatusBase & {
      type: 'closed';
      label: string;
      nextOpenText?: string;
    })
  | (OpeningStatusBase & {
      type: 'before-open';
      label: string;
      nextOpenText?: string;
      relativeText?: string;
    })
  | (OpeningStatusBase & {
      type: 'always-open';
      label: string;
    })
  | (OpeningStatusBase & {
      type: 'unknown';
      label: string;
      explanation?: string;
    });

type LocalClock = {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
};

type NextOpening = {
  minutes: number;
  dayOffset: number;
  point: PlaceOpeningHoursPoint;
};

export type PlaceOpeningTimelineRange = {
  start: number;
  end: number;
  startText: string;
  endText: string;
};

const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;
export type PlaceOpeningHoursMessages = {
  status: {
    open: string;
    closingSoon: string;
    closed: string;
    beforeOpen: string;
    alwaysOpen: string;
    unavailable: string;
    needsReview: string;
  };
  weekdays: readonly string[];
  shortWeekdays: readonly string[];
  today: string;
  tomorrow: string;
  nextDay: string;
  closed: string;
  alwaysOpenWeek: string;
  missingTimeZone: string;
  after: (time: string) => string;
  duration: (hours: number, minutes: number) => string;
  closesAfter: (duration: string) => string;
  opensAfter: (duration: string) => string;
  opensAt: (prefix: string, time: string) => string;
};

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

function formatDuration(minutes: number, messages: PlaceOpeningHoursMessages) {
  const rounded = Math.max(0, Math.ceil(minutes));
  const hours = Math.floor(rounded / 60);
  const remainingMinutes = rounded % 60;
  return messages.duration(hours, remainingMinutes);
}

function getParts(date: Date, hours: PlaceOpeningHours): LocalClock | null {
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

function calendarDay(clock: Pick<LocalClock, 'year' | 'month' | 'day'>) {
  return Math.floor(
    Date.UTC(clock.year, clock.month - 1, clock.day) / 86_400_000,
  );
}

function getPointDayOffset(point: PlaceOpeningHoursPoint, clock: LocalClock) {
  return point.date
    ? calendarDay(point.date) - calendarDay(clock)
    : point.day - clock.weekday;
}

function getPeriodDuration(period: PlaceOpeningHoursPeriod) {
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

function getTodayTimelineRanges(
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

function getOpeningTimeline(
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

function matchesDay(point: PlaceOpeningHoursPoint, clock: LocalClock) {
  return point.date
    ? point.date.year === clock.year &&
        point.date.month === clock.month &&
        point.date.day === clock.day
    : point.day === clock.weekday;
}

function isSamePointDay(
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

function isAlwaysOpen(schedule?: PlaceOpeningSchedule) {
  const periods = schedule?.periods;
  return (
    periods?.length === 1 &&
    periods[0].open.day === 0 &&
    periods[0].open.hour === 0 &&
    periods[0].open.minute === 0 &&
    periods[0].close === undefined
  );
}

function formatTodayHours(
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

function formatWeeklyHours(
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

function minutesUntil(timestamp: string | undefined, now: Date) {
  if (!timestamp) {
    return undefined;
  }
  const target = Date.parse(timestamp);
  if (!Number.isFinite(target) || target < now.getTime()) {
    return undefined;
  }
  return (target - now.getTime()) / 60_000;
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

function formatNextOpen(
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
