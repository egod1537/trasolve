import { L, type Localize } from '@/shared/i18n/L';

export function formatDurationMinutes(
  durationMinutes: number,
  localize: Localize = L,
): string {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  if (!hours) {
    return localize('place:placeDuration.formatDurationMinutes.text.minutes', {
      minutes,
    });
  }
  return minutes
    ? localize('place:placeDuration.formatDurationMinutes.text.hoursMinutes', {
        hours,
        minutes,
      })
    : localize('place:placeDuration.formatDurationMinutes.text.hours', {
        hours,
      });
}
