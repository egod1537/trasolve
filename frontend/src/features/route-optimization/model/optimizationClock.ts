export const MINUTES_PER_DAY = 24 * 60;

export const TROUTE_TIME_STEP_MINUTES = 10;

export function isClockTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function resolveServiceStartTime(
  arrivalTime: string,
  serviceStartTime: string | undefined,
  departureTime: string | undefined,
  waitMinutes: number | undefined,
  stayMinutes: number,
): string | null {
  if (serviceStartTime) {
    return serviceStartTime;
  }
  if (waitMinutes !== undefined) {
    return addClockMinutes(arrivalTime, waitMinutes);
  }
  if (departureTime) {
    return addClockMinutes(departureTime, -stayMinutes);
  }
  return arrivalTime;
}

export function addClockMinutes(time: string, minutes: number): string | null {
  const total = clockToMinutes(time) + minutes;
  if (total < 0 || total >= MINUTES_PER_DAY) {
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

export function isTenMinuteClock(value: string): boolean {
  return isClockTime(value) && isTenMinuteStep(clockToMinutes(value));
}

export function isTenMinuteStep(minutes: number): boolean {
  return (
    Number.isInteger(minutes) &&
    minutes >= 0 &&
    minutes % TROUTE_TIME_STEP_MINUTES === 0
  );
}

export function clockToMinutes(value: string): number {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
}
