import { useId } from 'react';
import type { PlaceOpeningHours } from '@trasolve/shared';
import { getPlaceOpeningStatus } from '../../domain/placeOpeningHours';

type Props = {
  hours: PlaceOpeningHours;
};

export function PlaceOpeningHoursDetails({ hours }: Props) {
  const weeklyHoursTitleId = useId();
  const status = getPlaceOpeningStatus(hours);
  const todayHours =
    status.type === 'always-open'
      ? '24시간 영업'
      : status.todayHours.length > 0
        ? status.todayHours.join(', ')
        : '휴무';

  return (
    <div className={`place-opening-details is-${status.type}`}>
      <p className="place-opening-status">
        <span className="place-opening-status-dot" aria-hidden="true" />
        <strong>{status.label}</strong>
      </p>

      <dl className="place-opening-detail-summary">
        <div>
          <dt>오늘 영업시간</dt>
          <dd>{todayHours}</dd>
        </div>
      </dl>

      <section
        className="place-opening-detail-weekly"
        aria-labelledby={weeklyHoursTitleId}
      >
        <h4 id={weeklyHoursTitleId}>요일별 영업시간</h4>
        {status.weeklyHours.length > 0 ? (
          <ul>
            {status.weeklyHours.map((description, index) => (
              <li key={`${index}-${description}`}>{description}</li>
            ))}
          </ul>
        ) : (
          <p>주간 영업시간 정보가 없습니다.</p>
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
