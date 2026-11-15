export type TimeRangeTimelineRange = { start: number; end: number };
export type RangeEdge = 'start' | 'end';
export const MINUTES_PER_DAY = 24 * 60;

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
export function snapTimelineMinute(
  minute: number,
  stepMinutes: number,
): number {
  return Math.round(minute / stepMinutes) * stepMinutes;
}
export function updateEditableRange(
  range: TimeRangeTimelineRange,
  edge: RangeEdge,
  minute: number,
  stepMinutes: number,
  minimumRangeMinutes: number,
): TimeRangeTimelineRange {
  if (edge === 'start') {
    const maximumStart =
      Math.floor((range.end - minimumRangeMinutes) / stepMinutes) * stepMinutes;
    return { ...range, start: clamp(minute, 0, maximumStart) };
  }
  const minimumEnd =
    Math.ceil((range.start + minimumRangeMinutes) / stepMinutes) * stepMinutes;
  return { ...range, end: clamp(minute, minimumEnd, MINUTES_PER_DAY) };
}
export function isSameRange(
  left: TimeRangeTimelineRange,
  right: TimeRangeTimelineRange,
): boolean {
  return left.start === right.start && left.end === right.end;
}
export function getEditableRange(
  ranges: readonly TimeRangeTimelineRange[],
  minimumRangeMinutes: number,
): TimeRangeTimelineRange | null {
  if (ranges.length !== 1) {
    return null;
  }
  const range = ranges[0]!;
  return range.start >= 0 &&
    range.end <= MINUTES_PER_DAY &&
    range.end - range.start >= minimumRangeMinutes
    ? range
    : null;
}
export function normalizeDayMinute(minute: number): number {
  return ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}
