import { type LocalPeriod } from '@/features/analytics-sessions/ui/analyticsSessionTypes';

export function createInitialPeriod(initialRange?: {
  from: Date;
  to: Date;
}): LocalPeriod {
  const to = initialRange?.to ?? new Date();
  const from = initialRange?.from ?? new Date(to.getTime() - 7 * 86_400_000);
  return { from: toLocalDateTimeInput(from), to: toLocalDateTimeInput(to) };
}

export function toLocalDateTimeInput(value: Date): string {
  const offsetMilliseconds = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offsetMilliseconds)
    .toISOString()
    .slice(0, 16);
}

export function localDateTimeToIso(value: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
