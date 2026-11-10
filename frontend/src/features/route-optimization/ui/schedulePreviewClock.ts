import type { TripPlace } from '@trasolve/shared';

export function getStayMinutes(place: TripPlace): number {
  return place.preferredDurationMinutes ?? place.visitDurationMinutes ?? 0;
}

export function addMinutes(time: string, minutes: number): string | null {
  const total = clockToMinutes(time) + minutes;
  if (total < 0 || total >= 24 * 60) {
    return null;
  }
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(
    total % 60,
  ).padStart(2, '0')}`;
}

export function getForwardMinutes(from: string, to: string): number | null {
  const difference = clockToMinutes(to) - clockToMinutes(from);
  return difference >= 0 ? difference : null;
}

export function clockToMinutes(value: string): number {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
}
