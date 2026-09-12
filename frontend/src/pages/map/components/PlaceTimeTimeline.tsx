import { useMemo, useState, type ReactNode } from 'react';
import type { PlaceOpeningHours } from '@trasolve/shared';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { formatClockTime } from '../domain/clockFormat';
import { formatDurationMinutes } from '../domain/placeDuration';
import { getPlaceOpeningStatus } from '../domain/placeOpeningHours';
import {
  MINUTES_PER_DAY,
  TimeRangeTimeline,
  type TimeRangeTimelineRange,
} from './TimeRangeTimeline';

type Props = {
  time?: string;
  durationMinutes?: number;
  openingHours?: PlaceOpeningHours;
  variant: 'compact' | 'expanded';
  readOnly?: boolean;
  busy?: boolean;
  saving?: boolean;
  onChangeTimeRange?: (
    time: string,
    durationMinutes: number,
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
  durationMinutes?: number;
  label: string;
};

const TIMELINE_SNAP_MINUTES = 30;
const DEFAULT_VISIT_DURATION_MINUTES = 60;

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
  durationMinutes: number | undefined,
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
  if (durationMinutes !== undefined) {
    labels.push(`체류 ${formatDurationMinutes(durationMinutes)}`);
  }
  if (opening) {
    labels.push(`영업 ${opening.startText}부터 ${opening.endText}까지`);
  }

  return {
    arrival,
    durationMinutes,
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
    <section className="place-time-detail" aria-label="시간 타임라인">
      <div className="place-time-detail-heading">
        <h3>시간</h3>
        {saving && (
          <>
            <LoadingSpinner size="sm" />
            <span className="sr-only" role="status">
              시간을 저장하고 있습니다.
            </span>
          </>
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
  durationMinutes,
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
    () => createTimelineModel(time, durationMinutes, openingHours, new Date()),
    [durationMinutes, openingHours, time],
  );
  const canEditTimeline =
    !readOnly && variant === 'expanded' && onChangeTimeRange !== undefined;
  if (!model.label && !canEditTimeline) {
    return null;
  }

  const effectiveDuration =
    canEditTimeline &&
    model.arrival !== undefined &&
    model.durationMinutes === undefined
      ? DEFAULT_VISIT_DURATION_MINUTES
      : model.durationMinutes;
  const stay =
    model.arrival !== undefined &&
    effectiveDuration !== undefined &&
    effectiveDuration > 0
      ? {
          start: model.arrival,
          end: model.arrival + effectiveDuration,
        }
      : undefined;
  const displayedStay = previewRange ?? stay;
  const displayedDuration = displayedStay
    ? displayedStay.end - displayedStay.start
    : effectiveDuration;
  const canEditExistingRange =
    canEditTimeline &&
    stay !== undefined &&
    stay.start >= 0 &&
    stay.end <= MINUTES_PER_DAY &&
    stay.end - stay.start >= TIMELINE_SNAP_MINUTES;
  const canCreateRange = canEditTimeline && model.arrival === undefined;
  const awaitingRangeCreation = canCreateRange && displayedStay === undefined;
  const previewRangeChange = (range: TimeRangeTimelineRange) => {
    setPreviewRange(
      stay && range.start === stay.start && range.end === stay.end
        ? null
        : range,
    );
  };
  const saveRangeChange = (range: TimeRangeTimelineRange) => {
    if (!onChangeTimeRange) {
      return;
    }
    void (async () => {
      try {
        await onChangeTimeRange(
          formatClockTime(range.start),
          range.end - range.start,
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
    if (!canCreateRange || busy) {
      return;
    }
    const visitDuration = Math.min(
      MINUTES_PER_DAY,
      Math.max(
        TIMELINE_SNAP_MINUTES,
        model.durationMinutes ?? DEFAULT_VISIT_DURATION_MINUTES,
      ),
    );
    const maximumStart =
      Math.floor((MINUTES_PER_DAY - visitDuration) / TIMELINE_SNAP_MINUTES) *
      TIMELINE_SNAP_MINUTES;
    const snappedStart =
      Math.round(startMinute / TIMELINE_SNAP_MINUTES) * TIMELINE_SNAP_MINUTES;
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
        displayedStay
          ? [displayedStay]
          : model.arrival === undefined
            ? []
            : [{ start: model.arrival, end: model.arrival }]
      }
      ariaLabel={
        awaitingRangeCreation
          ? '방문 시간이 설정되지 않았습니다. 타임라인에서 방문 시작 시간을 선택하세요.'
          : previewRange && displayedStay && displayedDuration !== undefined
            ? `방문 ${formatClockTime(displayedStay.start)}, 체류 ${formatDurationMinutes(displayedDuration)}`
            : model.label
      }
      rangeLabel={
        variant === 'compact' &&
        displayedStay &&
        displayedDuration !== undefined
          ? `체류 ${formatCompactDuration(displayedDuration)}`
          : undefined
      }
      variant={variant}
      wrapAroundMidnight
      editable={canEditTimeline}
      disabled={busy}
      stepMinutes={TIMELINE_SNAP_MINUTES}
      minimumRangeMinutes={TIMELINE_SNAP_MINUTES}
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
