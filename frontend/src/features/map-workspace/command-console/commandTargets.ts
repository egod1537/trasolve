import type { Trip, TripDay, TripPlace } from '@trasolve/shared';
export function resolveNamed<T extends { id: string }>(
  items: readonly T[],
  value: string,
  title: (item: T) => string,
): T {
  const byId = items.find((item) => item.id === value);
  if (byId) {
    return byId;
  }
  const found = items.filter(
    (item) =>
      title(item).normalize('NFKC').toLocaleLowerCase() ===
      value.normalize('NFKC').toLocaleLowerCase(),
  );
  if (found.length !== 1) {
    throw new Error(found.length ? 'AMBIGUOUS_TARGET' : 'TARGET_NOT_FOUND');
  }
  return found[0]!;
}
export function resolveDay(
  trip: Trip,
  value: string | number | undefined,
  selected: string | null,
): TripDay {
  if (value === undefined) {
    const day = trip.days.find((item) => item.id === selected);
    if (!day) {
      throw new Error('DAY_REQUIRED');
    }
    return day;
  }
  const ref = String(value);
  if (/^[1-9]\d*$/.test(ref)) {
    const day = trip.days[Number(ref) - 1];
    if (!day) {
      throw new Error('DAY_NOT_FOUND');
    }
    return day;
  }
  return resolveNamed(trip.days, ref, (day) => day.title);
}
export function resolvePlace(
  trip: Trip,
  value: string | number | undefined,
  selected: string | null,
): TripPlace {
  const places = trip.days.flatMap((day) => day.places);
  const reference = value === undefined ? selected : String(value);
  if (!reference) {
    throw new Error('PLACE_REQUIRED');
  }
  return resolveNamed(places, reference, (place) => place.name);
}
export function colorValue(value: string | number | undefined): string {
  const palette: Record<string, string> = {
    blue: '#3b82f6',
    red: '#ef4444',
    green: '#22c55e',
    orange: '#f97316',
    purple: '#a855f7',
    pink: '#ec4899',
    teal: '#14b8a6',
    yellow: '#eab308',
  };
  const color = palette[String(value)] ?? String(value);
  if (!/^#[a-f\d]{6}$/i.test(color)) {
    throw new Error('INVALID_COLOR');
  }
  return color;
}
export function clockMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours! * 60 + minutes!;
}
