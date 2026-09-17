import { useMemo, useState, type ReactNode } from 'react';
import type { PlaceOpeningHours } from '@trasolve/shared';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import { formatClockTime } from '@/entities/place';
import { formatDurationMinutes } from '@/entities/place';
import { getPlaceOpeningStatus } from '@/entities/place';
import {
  MIN_VISIT_DURATION_MINUTES,
  VISIT_TIME_GRANULARITY_MINUTES,
} from '@/entities/place';
import {
  MINUTES_PER_DAY,
  TimeRangeTimeline,
  type TimeRangeTimelineRange,
} from '@/features/place-editor/ui/TimeRangeTimeline';

type Props = {
  time?: string;
  visitDurationMinutes?: number;
  openingHours?: PlaceOpeningHours;
  variant: 'compact' | 'expanded';
  readOnly?: boolean;
  busy?: boolean;
  saving?: boolean;
  onChangeTimeRange?: (
    time: string,
    visitDurationMinutes: number,
  ) => Promise<boolean>;
};

type TimeRange = {
  start: number;
  end: number;
};

type OpeningRange = TimeRange & {
  startText: string;
  endText: string;
};

type TimelineModel = {
  arrival?: number;
  visitDurationMinutes?: number;
  label: string;
};

const DEFAULT_VISIT_DURATION_MINUTES = 60;

function snapVisitMinute(minute: number): number {
  return (
    Math.round(minute / VISIT_TIME_GRANULARITY_MINUTES) *
    VISIT_TIME_GRANULARITY_MINUTES
  );
}

function normalizeEditableVisitRange(
  range: TimeRangeTimelineRange,
): TimeRangeTimelineRange {
  let start = Math.max(
    0,
    Math.min(snapVisitMinute(range.start), MINUTES_PER_DAY),
  );
  let end = Math.max(0, Math.min(snapVisitMinute(range.end), MINUTES_PER_DAY));
  if (end - start < MIN_VISIT_DURATION_MINUTES) {
    end = Math.min(MINUTES_PER_DAY, start + MIN_VISIT_DURATION_MINUTES);
    start = Math.max(0, end - MIN_VISIT_DURATION_MINUTES);
  }
  return { start, end };
}

function parseClock(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return undefined;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    return undefined;
  }
  return hour * 60 + minute;
}

function formatCompactDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) {
    return `${remainder}분`;
  }
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function getOpeningRange(
  openingHours: PlaceOpeningHours | undefined,
  now: Date,
): OpeningRange | undefined {
  if (!openingHours) {
    return undefined;
  }
  const status = getPlaceOpeningStatus(openingHours, now);
  if (status.type === 'always-open') {
    return {
      start: 0,
      end: MINUTES_PER_DAY,
      startText: formatClockTime(0),
      endText: formatClockTime(MINUTES_PER_DAY, { endOfDay: true }),
    };
  }
  if (!status.timeline) {
    return undefined;
  }
  const start = parseClock(status.timeline.startText);
  let end = parseClock(status.timeline.endText);
  if (start === undefined || end === undefined) {
    return undefined;
  }
  if (end <= start) {
    end += MINUTES_PER_DAY;
  }
  return {
    start,
    end,
    startText: status.timeline.startText,
    endText: status.timeline.endText,
  };
}

function alignArrivalToOpening(
  arrival: number | undefined,
  opening: OpeningRange | undefined,
): number | undefined {
  if (
    arrival === undefined ||
    !opening ||
    opening.end <= MINUTES_PER_DAY ||
    arrival >= opening.start
  ) {
    return arrival;
  }
  return arrival < opening.end - MINUTES_PER_DAY
    ? arrival + MINUTES_PER_DAY
    : arrival;
}

function createTimelineModel(
  time: string | undefined,
  visitDurationMinutes: number | undefined,
  openingHours: PlaceOpeningHours | undefined,
  now: Date,
): TimelineModel {
  const opening = getOpeningRange(openingHours, now);
  const arrival = alignArrivalToOpening(parseClock(time), opening);
  const arrivalText =
    arrival === undefined ? undefined : formatClockTime(arrival);
  const labels: string[] = [];
  if (arrivalText) {
    labels.push(`방문 ${arrivalText}`);
  }
  if (visitDurationMinutes !== undefined) {
    labels.push(`방문 시간 ${formatDurationMinutes(visitDurationMinutes)}`);
  }
  if (opening) {
    labels.push(`영업 ${opening.startText}부터 ${opening.endText}까지`);
  }

  return {
    arrival,
    visitDurationMinutes,
    label: labels.join(', '),
  };
}

function ExpandedTimeline({
  timeline,
  saving,
  showCreateHint,
}: {
  timeline?: ReactNode;
  saving: boolean;
  showCreateHint: boolean;
}) {
  return (
    <section
      className="place-time-detail"
      aria-label="시간 타임라인"
      aria-busy={saving}
    >
      <div className="place-time-detail-heading">
        <h3>시간</h3>
        <span
          className={`place-time-saving-indicator${saving ? ' is-visible' : ''}`}
          aria-hidden="true"
        >
          <LoadingSpinner size="sm" />
        </span>
        {saving && (
          <span className="sr-only" role="status">
            시간을 저장하고 있습니다.
          </span>
        )}
      </div>
      {timeline}
      {showCreateHint && (
        <p className="place-time-create-hint">
          방문 시간을 설정하려면 타임라인을 클릭하세요
        </p>
      )}
    </section>
  );
}

export function PlaceTimeTimeline({
  time,
  visitDurationMinutes,
  openingHours,
  variant,
  readOnly = true,
  busy = false,
  saving = false,
  onChangeTimeRange,
}: Props) {
  const [previewRange, setPreviewRange] =
    useState<TimeRangeTimelineRange | null>(null);
  const model = useMemo(
    () =>
      createTimelineModel(time, visitDurationMinutes, openingHours, new Date()),
    [openingHours, time, visitDurationMinutes],
  );
  const canEditTimeline =
    !readOnly && variant === 'expanded' && onChangeTimeRange !== undefined;
  const timelineDisabled = busy || saving;
  if (!model.label && !canEditTimeline) {
    return null;
  }

  const effectiveVisitDuration =
    canEditTimeline &&
    model.arrival !== undefined &&
    model.visitDurationMinutes === undefined
      ? DEFAULT_VISIT_DURATION_MINUTES
      : model.visitDurationMinutes;
  const visitRange =
    model.arrival !== undefined &&
    effectiveVisitDuration !== undefined &&
    effectiveVisitDuration > 0
      ? {
          start: model.arrival,
          end: model.arrival + effectiveVisitDuration,
        }
      : undefined;
  const displayedVisitRange = previewRange ?? visitRange;
  const displayedDuration = displayedVisitRange
    ? displayedVisitRange.end - displayedVisitRange.start
    : effectiveVisitDuration;
  const canEditExistingRange =
    canEditTimeline &&
    visitRange !== undefined &&
    visitRange.start >= 0 &&
    visitRange.end <= MINUTES_PER_DAY &&
    visitRange.end - visitRange.start >= MIN_VISIT_DURATION_MINUTES;
  const canCreateRange = canEditTimeline && model.arrival === undefined;
  const awaitingRangeCreation =
    canCreateRange && displayedVisitRange === undefined;
  const previewRangeChange = (range: TimeRangeTimelineRange) => {
    const normalizedRange = normalizeEditableVisitRange(range);
    setPreviewRange(
      visitRange &&
        normalizedRange.start === visitRange.start &&
        normalizedRange.end === visitRange.end
        ? null
        : normalizedRange,
    );
  };
  const saveRangeChange = (range: TimeRangeTimelineRange) => {
    if (!onChangeTimeRange || timelineDisabled) {
      return;
    }
    const normalizedRange = normalizeEditableVisitRange(range);
    void (async () => {
      try {
        await onChangeTimeRange(
          formatClockTime(normalizedRange.start),
          normalizedRange.end - normalizedRange.start,
        );
      } catch {
        // The owning card surfaces mutation failures and the controlled data
        // restores the last persisted range.
      } finally {
        setPreviewRange(null);
      }
    })();
  };
  const createRange = (startMinute: number) => {
    if (!canCreateRange || timelineDisabled) {
      return;
    }
    const visitDuration = snapVisitMinute(
      Math.min(
        MINUTES_PER_DAY,
        Math.max(
          MIN_VISIT_DURATION_MINUTES,
          model.visitDurationMinutes ?? DEFAULT_VISIT_DURATION_MINUTES,
        ),
      ),
    );
    const maximumStart =
      Math.floor(
        (MINUTES_PER_DAY - visitDuration) / VISIT_TIME_GRANULARITY_MINUTES,
      ) * VISIT_TIME_GRANULARITY_MINUTES;
    const snappedStart = snapVisitMinute(startMinute);
    const start = Math.max(0, Math.min(snappedStart, maximumStart));
    const range = { start, end: start + visitDuration };
    setPreviewRange(range);
    saveRangeChange(range);
  };
  const shouldRenderTimeline =
    model.arrival !== undefined || (variant === 'expanded' && canEditTimeline);
  const timeline = !shouldRenderTimeline ? undefined : (
    <TimeRangeTimeline
      ranges={
        displayedVisitRange
          ? [displayedVisitRange]
          : model.arrival === undefined
            ? []
            : [{ start: model.arrival, end: model.arrival }]
      }
      ariaLabel={
        awaitingRangeCreation
          ? '방문 시간이 설정되지 않았습니다. 타임라인에서 방문 시작 시간을 선택하세요.'
          : previewRange &&
              displayedVisitRange &&
              displayedDuration !== undefined
            ? `방문 ${formatClockTime(displayedVisitRange.start)}, 방문 시간 ${formatDurationMinutes(displayedDuration)}`
            : model.label
      }
      rangeLabel={
        variant === 'compact' &&
        displayedVisitRange &&
        displayedDuration !== undefined
          ? `방문 ${formatCompactDuration(displayedDuration)}`
          : undefined
      }
      variant={variant}
      wrapAroundMidnight
      editable={canEditTimeline}
      disabled={timelineDisabled}
      stepMinutes={VISIT_TIME_GRANULARITY_MINUTES}
      minimumRangeMinutes={MIN_VISIT_DURATION_MINUTES}
      onRangeChange={canEditExistingRange ? previewRangeChange : undefined}
      onRangeChangeEnd={canEditExistingRange ? saveRangeChange : undefined}
      onCreateRange={canCreateRange ? createRange : undefined}
    />
  );

  return variant === 'compact' ? (
    timeline ? (
      <span className="place-time-summary">{timeline}</span>
    ) : null
  ) : (
    <ExpandedTimeline
      timeline={timeline}
      saving={saving}
      showCreateHint={awaitingRangeCreation}
    />
  );
}
