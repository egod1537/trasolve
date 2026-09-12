import type {
  PlaceOpeningHours,
  PlaceOpeningHoursPeriod,
  PlaceOpeningHoursPoint,
  PlaceOpeningSchedule,
} from '@trasolve/shared';
import { formatClockTime } from './clockFormat';

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
      label: '영업 중';
      relativeText?: string;
    })
  | (OpeningStatusBase & {
      type: 'closing-soon';
      label: '곧 마감';
      relativeText?: string;
    })
  | (OpeningStatusBase & {
      type: 'closed';
      label: '영업 종료';
      nextOpenText?: string;
    })
  | (OpeningStatusBase & {
      type: 'before-open';
      label: '영업 전';
      nextOpenText?: string;
      relativeText?: string;
    })
  | (OpeningStatusBase & {
      type: 'always-open';
      label: '24시간 영업';
    })
  | (OpeningStatusBase & {
      type: 'unknown';
      label: '영업시간 정보 없음' | '영업시간 확인 필요';
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
const weekdayLabels = [
  '일요일',
  '월요일',
  '화요일',
  '수요일',
  '목요일',
  '금요일',
  '토요일',
];
const shortWeekdayLabels = ['일', '월', '화', '수', '목', '금', '토'];

function formatDuration(minutes: number) {
  const rounded = Math.max(0, Math.ceil(minutes));
  if (rounded < 60) {
    return `${rounded}분`;
  }
  const hours = Math.floor(rounded / 60);
  const remainingMinutes = rounded % 60;
  return remainingMinutes
    ? `${hours}시간 ${remainingMinutes}분`
    : `${hours}시간`;
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
          text: `${formatClockTime(period.open)} 이후`,
        });
        continue;
      }
      const nextDay = !isSamePointDay(period.open, period.close);
      ranges.push({
        start,
        text: `${formatClockTime(period.open)} ~ ${nextDay ? '익일 ' : ''}${formatClockTime(period.close)}`,
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

function formatWeeklyHours(schedule?: PlaceOpeningSchedule) {
  if (schedule?.weekdayDescriptions?.length) {
    return schedule.weekdayDescriptions;
  }
  if (!schedule?.periods) {
    return [];
  }
  if (isAlwaysOpen(schedule)) {
    return ['월~일 24시간 영업'];
  }

  return [1, 2, 3, 4, 5, 6, 0].map((day) => {
    const ranges = schedule
      .periods!.filter((period) => !period.open.date && period.open.day === day)
      .map((period) => {
        if (!period.close) {
          return `${formatClockTime(period.open)} 이후`;
        }
        return `${formatClockTime(period.open)} ~ ${formatClockTime(period.close)}`;
      });
    return `${shortWeekdayLabels[day]} ${ranges.length ? ranges.join(', ') : '휴무'}`;
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

function formatNextOpen(next: NextOpening) {
  const prefix =
    next.dayOffset <= 0
      ? '오늘'
      : next.dayOffset === 1
        ? '내일'
        : weekdayLabels[next.point.day];
  return `${prefix} ${formatClockTime(next.point)} 오픈`;
}

export function getPlaceOpeningStatus(
  hours: PlaceOpeningHours | undefined,
  now = new Date(),
): PlaceOpeningStatus {
  const current = hours?.current;
  const regular = hours?.regular;
  const weeklyHours = formatWeeklyHours(regular ?? current);
  const base = {
    todayHours: [] as string[],
    weeklyHours,
    timelineRanges: [] as PlaceOpeningTimelineRange[],
  };

  if (!hours || (!current && !regular)) {
    return { ...base, type: 'unknown', label: '영업시간 정보 없음' };
  }

  const localNow = getParts(now, hours);
  if (!localNow) {
    return {
      ...base,
      type: 'unknown',
      label: '영업시간 확인 필요',
      explanation:
        '장소의 현지 시간대 정보가 없어 실시간 상태를 계산하지 않습니다.',
    };
  }

  if (isAlwaysOpen(regular)) {
    return {
      ...base,
      type: 'always-open',
      label: '24시간 영업',
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
  const todayHours = formatTodayHours(periods, localNow);
  const timelineRanges = getTodayTimelineRanges(periods, localNow);
  const resultBase = { todayHours, weeklyHours, timelineRanges };
  const timing = getWeeklyTiming(periods, localNow);
  const openNow = schedule?.openNow ?? timing.open;

  if (openNow) {
    const closeIn =
      minutesUntil(schedule?.nextCloseTime, now) ?? timing.minutesUntilClose;
    const relativeText =
      closeIn === undefined ? undefined : `${formatDuration(closeIn)} 후 마감`;
    return closeIn !== undefined && closeIn <= CLOSING_SOON_THRESHOLD_MINUTES
      ? {
          ...resultBase,
          type: 'closing-soon',
          label: '곧 마감',
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
          label: '영업 중',
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
      label: '영업 종료',
      timeline: getOpeningTimeline(timelineRanges, localNow, 'closed'),
    };
  }

  const nextOpenText = formatNextOpen(next);
  if (next.dayOffset === 0) {
    return {
      ...resultBase,
      type: 'before-open',
      label: '영업 전',
      nextOpenText,
      relativeText: `${formatDuration(next.minutes)} 후 영업 시작`,
      timeline: getOpeningTimeline(timelineRanges, localNow, 'before-open'),
    };
  }
  return {
    ...resultBase,
    type: 'closed',
    label: '영업 종료',
    nextOpenText,
    timeline: getOpeningTimeline(timelineRanges, localNow, 'closed'),
  };
}
