import type { PlaceOpeningHoursPoint } from '@trasolve/shared';

export type OpeningStatusBase = {
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

export type LocalClock = {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
};

export type NextOpening = {
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
