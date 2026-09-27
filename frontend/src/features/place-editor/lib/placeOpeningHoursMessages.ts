import type { PlaceOpeningHoursMessages } from '@/entities/place';
import type { Localize } from '@/shared/i18n';

export function createPlaceOpeningHoursMessages(
  L: Localize,
): PlaceOpeningHoursMessages {
  return {
    status: {
      open: L('place:placeOpeningHours.text.open'),
      closingSoon: L('place:placeOpeningHours.text.dueSoon'),
      closed: L('place:placeOpeningHours.text.closed'),
      beforeOpen: L('place:placeOpeningHours.text.beforeSales'),
      alwaysOpen: L('place:placeOpeningHours.text.open24Hours'),
      unavailable: L('place:placeOpeningHours.text.noBusinessHoursInformation'),
      needsReview: L('place:placeOpeningHours.text.needCheckBusinessHours'),
    },
    weekdays: [
      L('place:placeOpeningHours.weekdayLabels.text.sunday'),
      L('place:placeOpeningHours.weekdayLabels.text.monday'),
      L('place:placeOpeningHours.weekdayLabels.text.tuesday'),
      L('place:placeOpeningHours.weekdayLabels.text.wednesday'),
      L('place:placeOpeningHours.weekdayLabels.text.thursday'),
      L('place:placeOpeningHours.weekdayLabels.text.friday'),
      L('place:placeOpeningHours.weekdayLabels.text.saturday'),
    ],
    shortWeekdays: [
      L('place:placeOpeningHours.shortWeekdayLabels.text.work'),
      L('place:placeOpeningHours.shortWeekdayLabels.text.month'),
      L('place:placeOpeningHours.shortWeekdayLabels.text.angry'),
      L('place:placeOpeningHours.shortWeekdayLabels.text.number'),
      L('place:placeOpeningHours.shortWeekdayLabels.text.neck'),
      L('place:placeOpeningHours.shortWeekdayLabels.text.gold'),
      L('place:placeOpeningHours.shortWeekdayLabels.text.sat'),
    ],
    today: L('place:placeOpeningHours.formatNextOpen.text.today'),
    tomorrow: L('place:placeOpeningHours.formatNextOpen.text.tomorrow'),
    nextDay: L('place:placeOpeningHours.formatTodayHours.text.nextDay'),
    closed: L('place:placeOpeningHours.formatWeeklyHours.text.closed'),
    alwaysOpenWeek: L(
      'place:placeOpeningHours.formatWeeklyHours.text.open24HoursFromMondaySunday',
    ),
    missingTimeZone: L(
      'place:placeOpeningHours.getPlaceOpeningStatus.text.noRealTimeStatusCalculatedAs',
    ),
    after: (time) =>
      L('place:placeOpeningHours.formatTodayHours.text.after', {
        formatClockTime: time,
      }),
    duration: (hours, minutes) => {
      if (!hours) {
        return L('place:placeOpeningHours.formatDuration.text.minutes', {
          rounded: minutes,
        });
      }
      return minutes
        ? L('place:placeOpeningHours.formatDuration.text.hoursMinutes', {
            hours,
            remainingMinutes: minutes,
          })
        : L('place:placeDuration.formatDurationMinutes.text.hours', { hours });
    },
    closesAfter: (duration) =>
      L('place:placeOpeningHours.getPlaceOpeningStatus.text.closedAfter', {
        formatDuration: duration,
      }),
    opensAfter: (duration) =>
      L(
        'place:placeOpeningHours.getPlaceOpeningStatus.text.businessStartsAfter',
        { formatDuration: duration },
      ),
    opensAt: (prefix, time) =>
      L('place:placeOpeningHours.formatNextOpen.text.open', {
        prefix,
        formatClockTime: time,
      }),
  };
}
