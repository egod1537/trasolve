import { useId } from 'react';
import type { PlaceOpeningHours } from '@trasolve/shared';
import { getPlaceOpeningStatus } from '@/entities/place';
import { createPlaceOpeningHoursMessages } from '@/features/place-editor/lib/placeOpeningHoursMessages';
import { useL } from '@/shared/i18n';

type Props = {
  hours: PlaceOpeningHours;
};

export function PlaceOpeningHoursDetails({ hours }: Props) {
  const L = useL();
  const weeklyHoursTitleId = useId();
  const status = getPlaceOpeningStatus(
    hours,
    new Date(),
    createPlaceOpeningHoursMessages(L),
  );
  const todayHours =
    status.type === 'always-open'
      ? L('place:placeOpeningHours.text.open24Hours')
      : status.todayHours.length > 0
        ? status.todayHours.join(', ')
        : L('place:placeOpeningHours.formatWeeklyHours.text.closed');

  return (
    <div className={`place-opening-details is-${status.type}`}>
      <p className="place-opening-status">
        <span className="place-opening-status-dot" aria-hidden="true" />
        <strong>{status.label}</strong>
      </p>

      <dl className="place-opening-detail-summary">
        <div>
          <dt>
            {L('place:placeOpeningHoursDetails.label.businessHoursToday')}
          </dt>
          <dd>{todayHours}</dd>
        </div>
      </dl>

      <section
        className="place-opening-detail-weekly"
        aria-labelledby={weeklyHoursTitleId}
      >
        <h4 id={weeklyHoursTitleId}>
          {L('place:placeOpeningHoursDetails.title.businessHoursByDay')}
        </h4>
        {status.weeklyHours.length > 0 ? (
          <ul>
            {status.weeklyHours.map((description, index) => (
              <li key={`${index}-${description}`}>{description}</li>
            ))}
          </ul>
        ) : (
          <p>
            {L(
              'place:placeOpeningHoursDetails.description.weeklyBusinessHoursInformationNotAvailable',
            )}
          </p>
        )}
      </section>

      {'nextOpenText' in status && status.nextOpenText && (
        <p className="place-opening-detail-note">{status.nextOpenText}</p>
      )}
      {'relativeText' in status && status.relativeText && (
        <p className="place-opening-detail-note">{status.relativeText}</p>
      )}
      {'explanation' in status && status.explanation && (
        <p className="place-opening-detail-note">{status.explanation}</p>
      )}
    </div>
  );
}
