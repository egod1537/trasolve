import {
  TimeRangeTimeline,
  type TimeRangeTimelineRange,
} from '@/features/place-editor';

type ScheduleLegKind = 'travel' | 'wait';

type Props = {
  label: string;
  durationMinutes: number | null;
  startTime?: string | null;
  endTime?: string | null;
  kind: ScheduleLegKind;
};

const CLOCK_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function ScheduleLegTimeline({
  label,
  durationMinutes,
  startTime,
  endTime,
  kind,
}: Props) {
  const range = createTimelineRange(startTime, endTime, durationMinutes);
  if (!range || !startTime || !endTime || durationMinutes === null) {
    return (
      <span className="route-optimization-schedule-leg-fallback">
        {kind === 'travel' ? '이동 시간 정보 없음' : '시간 정보 없음'}
      </span>
    );
  }

  return (
    <TimeRangeTimeline
      ranges={[range]}
      ariaLabel={`${label} ${startTime}부터 ${endTime}까지, ${durationMinutes}분`}
      tone={kind === 'travel' ? 'travel' : 'muted'}
      variant="compact"
    />
  );
}

function createTimelineRange(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  durationMinutes: number | null,
): TimeRangeTimelineRange | null {
  if (
    !startTime ||
    !endTime ||
    durationMinutes === null ||
    !Number.isFinite(durationMinutes) ||
    durationMinutes <= 0 ||
    !CLOCK_TIME_PATTERN.test(startTime) ||
    !CLOCK_TIME_PATTERN.test(endTime)
  ) {
    return null;
  }

  const start = clockToMinutes(startTime);
  const end = clockToMinutes(endTime);
  return end > start ? { start, end } : null;
}

function clockToMinutes(value: string): number {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
}
