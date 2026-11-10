import type { TripPlace } from '@trasolve/shared';
import { formatClockTime } from './clockFormat';

/** Numeric visit-time data for map callouts; missing times stay unset. */
export function formatPlaceVisitTime(
  place: Pick<
    TripPlace,
    'time' | 'preferredDurationMinutes' | 'visitDurationMinutes'
  >,
): string | undefined {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(place.time ?? '');
  if (!match) {
    return undefined;
  }
  const start = Number(match[1]) * 60 + Number(match[2]);
  const duration = place.preferredDurationMinutes ?? place.visitDurationMinutes;
  if (duration === undefined || !Number.isFinite(duration) || duration <= 0) {
    return formatClockTime(start);
  }
  return [
    formatClockTime(start),
    formatClockTime(start + duration, { endOfDay: true }),
  ].join('–');
}
