type ClockValue =
  | number
  | {
      readonly hour: number;
      readonly minute: number;
    };

type FormatClockTimeOptions = {
  endOfDay?: boolean;
};

const MINUTES_PER_DAY = 24 * 60;

/** Formats clock values as locale-independent 24-hour HH:mm text. */
export function formatClockTime(
  value: ClockValue,
  options?: FormatClockTimeOptions,
): string {
  const totalMinutes =
    typeof value === 'number' ? value : value.hour * 60 + value.minute;
  const wholeMinutes = Math.trunc(totalMinutes);
  if (
    options?.endOfDay &&
    wholeMinutes > 0 &&
    wholeMinutes % MINUTES_PER_DAY === 0
  ) {
    return '24:00';
  }
  const normalized =
    ((wholeMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
