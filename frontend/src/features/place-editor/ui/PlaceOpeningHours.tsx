import { useEffect, useMemo, useState } from 'react';
import type { PlaceOpeningHours as PlaceOpeningHoursData } from '@trasolve/shared';
import { getPlaceOpeningStatus } from '@/entities/place';
import { TimeRangeTimeline } from '@/features/place-editor/ui/TimeRangeTimeline';
import { createPlaceOpeningHoursMessages } from '@/features/place-editor/lib/placeOpeningHoursMessages';
import { useL } from '@/shared/i18n';

type Props = {
  hours?: PlaceOpeningHoursData;
  loadState?: 'ready' | 'loading' | 'error';
  detailsOpen?: boolean;
  detailsControlId?: string;
  onToggleDetails?: () => void;
};

export function PlaceOpeningHours({
  hours,
  loadState = 'ready',
  detailsOpen = false,
  detailsControlId,
  onToggleDetails,
}: Props) {
  const L = useL();
  const [now, setNow] = useState(() => new Date());
  const status = useMemo(
    () => getPlaceOpeningStatus(hours, now, createPlaceOpeningHoursMessages(L)),
    [L, hours, now],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (loadState !== 'ready') {
    return (
      <section
        className="place-opening-hours is-unknown"
        aria-label={L('place:placeDetailContent.tooltip.businessHours')}
      >
        <p className="place-opening-status">
          <span className="place-opening-status-dot" aria-hidden="true" />
          <strong>
            {loadState === 'loading'
              ? L('place:placeOpeningHours.text.loadingBusinessHours')
              : L('place:placeOpeningHours.text.noBusinessHoursInformation')}
          </strong>
        </p>
        {loadState === 'error' && (
          <p className="place-opening-explanation">
            {L(
              'place:placeOpeningHours.description.locationOpeningHoursCouldNotBe',
            )}
          </p>
        )}
      </section>
    );
  }

  const showTodayHours =
    status.type !== 'always-open' && status.type !== 'unknown';
  const timelineTone =
    status.type === 'closing-soon'
      ? 'warning'
      : status.type === 'closed'
        ? 'muted'
        : status.type === 'before-open'
          ? 'primary'
          : 'opening';
  const timelineLabel = status.timelineRanges.length
    ? L('place:placeOpeningHours.text.businessHoursToday', {
        value: status.timelineRanges
          .map((range) =>
            L('place:placeOpeningHours.text.from', {
              startText: range.startText,
              endText: range.endText,
            }),
          )
          .join(', '),
      })
    : L('place:placeOpeningHours.text.noOpeningsToday');

  return (
    <section
      className={`place-opening-hours is-${status.type}`}
      aria-label={L('place:placeDetailContent.tooltip.businessHours')}
    >
      <div className="place-opening-header-row">
        <p className="place-opening-status">
          <span className="place-opening-status-dot" aria-hidden="true" />
          <strong>{status.label}</strong>
        </p>
        {status.weeklyHours.length > 0 && onToggleDetails && (
          <button
            type="button"
            className="place-opening-detail-trigger"
            aria-expanded={detailsOpen}
            aria-controls={detailsControlId}
            aria-label={
              detailsOpen
                ? L('place:placeDetailContent.text.closeBusinessHoursDetails')
                : L('place:placeOpeningHours.ariaLabel.viewAllBusinessHours')
            }
            onClick={onToggleDetails}
          >
            {L('place:placeOpeningHours.ariaLabel.viewAllBusinessHours')}
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="m6 3 5 5-5 5" />
            </svg>
          </button>
        )}
      </div>

      {showTodayHours &&
        (status.todayHours.length <= 1 ? (
          <p className="place-opening-today">
            {L('place:placeOpeningHours.formatNextOpen.text.today')}
            {status.todayHours[0] ??
              L('place:placeOpeningHours.formatWeeklyHours.text.closed')}
          </p>
        ) : (
          <div className="place-opening-today is-split">
            <span>
              {L('place:placeOpeningHours.formatNextOpen.text.today')}
            </span>
            <ul>
              {status.todayHours.map((range) => (
                <li key={range}>{range}</li>
              ))}
            </ul>
          </div>
        ))}

      {status.type !== 'unknown' && (
        <TimeRangeTimeline
          ranges={status.timelineRanges}
          ariaLabel={timelineLabel}
          tone={timelineTone}
        />
      )}

      {'nextOpenText' in status && status.nextOpenText && (
        <p className="place-opening-next">{status.nextOpenText}</p>
      )}
      {'relativeText' in status && status.relativeText && (
        <p className="place-opening-relative">{status.relativeText}</p>
      )}
      {'explanation' in status && status.explanation && (
        <p className="place-opening-explanation">{status.explanation}</p>
      )}
    </section>
  );
}
