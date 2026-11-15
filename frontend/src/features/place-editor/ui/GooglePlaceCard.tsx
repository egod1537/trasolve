import { ScrollArea } from '@/shared/ui/ScrollArea';
import { useState, type ReactNode } from 'react';
import {
  ANALYTICS_SCREENS,
  ANALYTICS_TARGETS,
  type PlaceDetails,
} from '@trasolve/shared';
import type { SelectedGooglePlace } from '@/entities/place';
import { MapPopupCardShell } from '@/shared/ui/map/MapPopupCardShell';
import { PlaceOpeningHours } from '@/features/place-editor/ui/PlaceOpeningHours';
import { getLanguage, useL } from '@/shared/i18n';
import { trackEvent, useScreenView } from '@/shared/analytics';
import { useTutorial } from '@/features/onboarding';
import './google-place-card.css';

type Props = {
  selection: Exclude<SelectedGooglePlace, null>;
  activeDayId: string | null;
  busy: boolean;
  mutationError: string | null;
  onClose: () => void;
  onRetry: () => void;
  onAddToTrip: (dayId: string, place: PlaceDetails) => Promise<boolean>;
};

function PlaceLoadingSkeleton() {
  const L = useL();
  return (
    <div className="google-place-card-loading" role="status">
      <span className="sr-only">
        {L('place:googlePlaceCard.description.loadingLocationInformation')}
      </span>
      <div className="google-place-card-skeleton-layout" aria-hidden="true">
        <div className="google-place-card-skeleton-section">
          <span className="google-place-skeleton is-medium" />
          <span className="google-place-skeleton is-wide" />
        </div>
        <div className="google-place-card-skeleton-section">
          <span className="google-place-skeleton is-short" />
          <span className="google-place-skeleton is-wide" />
          <span className="google-place-skeleton is-medium" />
          <span className="google-place-skeleton is-medium" />
        </div>
        <div className="google-place-card-skeleton-footer">
          <span className="google-place-skeleton is-button" />
        </div>
      </div>
    </div>
  );
}

function displayUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function InfoIcon({ type }: { type: 'address' | 'web' | 'phone' }) {
  const paths = {
    address:
      'M12 21s6-5.35 6-12a6 6 0 1 0-12 0c0 6.65 6 12 6 12Zm0-9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
    web: 'M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18M4.5 7.5h15M4.5 16.5h15',
    phone:
      'M7.2 3.5 10 7.2 8.4 9.3a15.5 15.5 0 0 0 6.3 6.3l2.1-1.6 3.7 2.8-1.2 3c-.3.8-1.1 1.2-2 1.1C9.8 19.8 4.2 14.2 3.1 6.7c-.1-.9.3-1.7 1.1-2l3-1.2Z',
  } as const;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[type]} />
    </svg>
  );
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: Parameters<typeof InfoIcon>[0]['type'];
  label: string;
  children: ReactNode;
}) {
  if (!children) {
    return <div className="place-info-row" aria-hidden="true" />;
  }
  return (
    <div className="place-info-row">
      <dt>
        <InfoIcon type={icon} />
        <span className="sr-only">{label}</span>
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

function Rating({ place }: { place: PlaceDetails }) {
  const L = useL();
  const reviewCount = new Intl.NumberFormat(getLanguage());
  if (place.rating === undefined) {
    return <p className="place-info-rating" aria-hidden="true" />;
  }
  return (
    <p
      className="place-info-rating"
      aria-label={L('place:googlePlaceCard.rating.ariaLabel.ratingPoints', {
        toFixed: place.rating.toFixed(1),
        value:
          place.userRatingCount === undefined
            ? ''
            : L('place:googlePlaceCard.rating.ariaLabel.reviews', {
                format: reviewCount.format(place.userRatingCount),
              }),
      })}
    >
      <span aria-hidden="true">★</span>
      <strong>{place.rating.toFixed(1)}</strong>
      {place.userRatingCount !== undefined && (
        <small>
          ·{' '}
          {L('place:googlePlaceCard.text.reviews', {
            reviewCount: reviewCount.format(place.userRatingCount),
          })}
        </small>
      )}
    </p>
  );
}

export function GooglePlaceCard({
  selection,
  activeDayId,
  busy,
  mutationError,
  onClose,
  onRetry,
  onAddToTrip,
}: Props) {
  const L = useL();
  useScreenView(ANALYTICS_SCREENS.placeDetail);
  const tutorial = useTutorial();
  const [submitting, setSubmitting] = useState(false);
  const [addFailed, setAddFailed] = useState(false);
  const place = selection.status === 'loaded' ? selection.place : null;
  const disabled = busy || submitting;

  const addToDay = async (dayId: string) => {
    if (!place || disabled) {
      return;
    }
    trackEvent({
      eventType: 'button_click',
      screen: ANALYTICS_SCREENS.placeDetail,
      target: ANALYTICS_TARGETS.addPlace,
    });
    setSubmitting(true);
    setAddFailed(false);
    try {
      if (!(await onAddToTrip(dayId, place))) {
        setAddFailed(true);
        return;
      }
      trackEvent({
        eventType: 'add_place',
        screen: ANALYTICS_SCREENS.placeDetail,
        target: ANALYTICS_TARGETS.addPlace,
        metadata: { source: 'google_place_card', success: true },
      });
      tutorial?.completeStep('add-place');
    } catch {
      setAddFailed(true);
    } finally {
      setSubmitting(false);
    }
  };

  const loading = selection.status === 'loading';
  return (
    <MapPopupCardShell
      className="google-place-card"
      title={
        loading ? (
          <>
            <span className="sr-only">
              {L('place:googlePlaceCard.tooltip.locationInformation')}
            </span>
            <span
              className="google-place-skeleton is-title"
              aria-hidden="true"
            />
          </>
        ) : (
          (place?.name ??
          L('place:googlePlaceCard.tooltip.locationInformation'))
        )
      }
      subtitle={
        loading ? (
          <p className="place-info-card-category" aria-hidden="true">
            <span className="google-place-skeleton is-short" />
          </p>
        ) : place?.category ? (
          <p className="place-info-card-category">{place.category}</p>
        ) : undefined
      }
      closeLabel={L('place:googlePlaceCard.text.closeGooglePlacesDetailCard')}
      onClose={onClose}
    >
      <ScrollArea
        className="google-place-card-content"
        contentClassName="google-place-card-content-content"
        viewportProps={{ 'aria-busy': loading }}
      >
        {loading && <PlaceLoadingSkeleton />}
        {selection.status === 'error' && (
          <div className="place-info-card-state is-error" role="alert">
            <p>
              {L(
                'place:googlePlaceCard.description.failedLoadLocationInformation',
              )}
            </p>
            <button
              type="button"
              className="google-place-card-retry"
              onClick={onRetry}
            >
              {L('common:action.retry')}
            </button>
          </div>
        )}

        {place && (
          <>
            <div className="google-place-card-hours">
              {(place.openingHours?.current || place.openingHours?.regular) && (
                <PlaceOpeningHours hours={place.openingHours} />
              )}
            </div>
            <div className="place-info-card-body">
              <Rating place={place} />

              <dl className="place-info-details">
                <InfoRow
                  icon="address"
                  label={L('place:googlePlaceCard.text.address')}
                >
                  {place.address}
                </InfoRow>
                <InfoRow
                  icon="web"
                  label={L('place:googlePlaceCard.text.website')}
                >
                  {place.website && (
                    <a href={place.website} target="_blank" rel="noreferrer">
                      {displayUrl(place.website)}
                    </a>
                  )}
                </InfoRow>
                <InfoRow
                  icon="phone"
                  label={L('place:googlePlaceCard.text.phoneNumber')}
                >
                  {place.phoneNumber && (
                    <a href={`tel:${place.phoneNumber.replace(/[^\d+]/g, '')}`}>
                      {place.phoneNumber}
                    </a>
                  )}
                </InfoRow>
              </dl>

              <div
                className="place-info-card-links"
                aria-hidden={place.googleMapsUrl ? undefined : true}
              >
                {place.googleMapsUrl && (
                  <a
                    className="place-info-google-link"
                    href={place.googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {L('place:googlePlaceCard.text.viewGoogleMaps')}
                    <span aria-hidden="true">↗</span>
                  </a>
                )}
              </div>
            </div>

            <footer className="place-info-card-footer">
              <span
                className="place-info-add-control"
                data-tooltip={
                  activeDayId
                    ? undefined
                    : L('place:googlePlaceCard.text.addAnotherLayer')
                }
                tabIndex={activeDayId ? undefined : 0}
                aria-label={
                  activeDayId
                    ? undefined
                    : L('place:googlePlaceCard.text.addAnotherLayer')
                }
              >
                <button
                  type="button"
                  className="place-info-add-button"
                  data-tutorial="add-place"
                  data-analytics-id={ANALYTICS_TARGETS.addPlace}
                  data-analytics-screen={ANALYTICS_SCREENS.placeDetail}
                  aria-busy={submitting}
                  disabled={disabled || !activeDayId}
                  onClick={() => {
                    if (activeDayId) {
                      void addToDay(activeDayId);
                    }
                  }}
                >
                  <span aria-hidden="true">＋</span>
                  {submitting
                    ? L('place:googlePlaceCard.action.adding')
                    : L('place:googlePlaceCard.action.addSchedule')}
                </button>
              </span>
              {addFailed && (
                <p className="place-info-action-error" role="alert">
                  {mutationError ??
                    L('place:googlePlaceCard.description.failedAddLocation')}
                </p>
              )}
            </footer>
          </>
        )}
      </ScrollArea>
    </MapPopupCardShell>
  );
}
