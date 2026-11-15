import type { PlaceOpeningHours, PlaceOpeningSchedule } from '@trasolve/shared';
import { calendarDay, getParts } from './openingHoursClock';

/** Missing periods are unknown; an explicit empty array means closed. */
export function selectOpeningSchedule(
  hours: PlaceOpeningHours | undefined,
  reference: Date,
): PlaceOpeningSchedule | undefined {
  if (!hours) {
    return undefined;
  }
  if (
    hours.current?.periods !== undefined &&
    currentScheduleApplies(hours, reference)
  ) {
    return hours.current;
  }
  return hours.regular?.periods !== undefined ? hours.regular : undefined;
}

function currentScheduleApplies(
  hours: PlaceOpeningHours,
  reference: Date,
): boolean {
  const target = getParts(reference, hours);
  const fetched = getParts(new Date(hours.fetchedAt ?? Date.now()), hours);
  if (!target || !fetched) {
    return false;
  }
  const day = calendarDay(target);
  const start = calendarDay(fetched);
  const dates = (hours.current?.periods ?? [])
    .flatMap((period) => [period.open.date, period.close?.date])
    .filter((date) => date !== undefined)
    .map(calendarDay);
  if (day >= start && day < start + 7) {
    // Legacy snapshots have no fetch stamp. Do not reuse obviously stale dates
    // just because today's date lies inside the newly inferred seven-day range.
    return (
      hours.fetchedAt !== undefined ||
      dates.length === 0 ||
      dates.some((date) => date >= start && date < start + 7)
    );
  }
  // Old persisted trips can still use explicit dated periods for historical
  // visits. Outside that known span, fall back to regular weekly hours.
  return (
    hours.fetchedAt === undefined &&
    dates.length > 0 &&
    day >= Math.min(...dates) &&
    day <= Math.max(...dates)
  );
}
