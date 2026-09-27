import { useState, type ReactNode } from 'react';
import type { PlaceDetails } from '@trasolve/shared';
import type { SelectedGooglePlace } from '@/entities/place';
import { MapPopupCardShell } from '@/shared/ui/map/MapPopupCardShell';
import { PlaceOpeningHours } from '@/features/place-editor/ui/PlaceOpeningHours';
import { getLanguage, useL } from '@/shared/i18n';

type Props = {
  selection: Exclude<SelectedGooglePlace, null>;
  activeDayId: string | null;
  busy: boolean;
  mutationError: string | null;
  onClose: () => void;
  onAddToTrip: (dayId: string, place: PlaceDetails) => Promise<boolean>;
};

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
    return null;
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
  onAddToTrip,
}: Props) {
  const L = useL();
  const [submitting, setSubmitting] = useState(false);
  const [addFailed, setAddFailed] = useState(false);
  const place = selection.status === 'loaded' ? selection.place : null;
  const disabled = busy || submitting;

  const addToDay = async (dayId: string) => {
    if (!place || disabled) {
      return;
    }
    setSubmitting(true);
    setAddFailed(false);
    try {
      if (!(await onAddToTrip(dayId, place))) {
        setAddFailed(true);
      }
    } catch {
      setAddFailed(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MapPopupCardShell
      className="google-place-card"
      title={
        place?.name ?? L('place:googlePlaceCard.tooltip.locationInformation')
      }
      subtitle={
        place?.category ? (
          <p className="place-info-card-category">{place.category}</p>
        ) : undefined
      }
      closeLabel={L('place:googlePlaceCard.text.closeGooglePlacesDetailCard')}
      onClose={onClose}
    >
      {selection.status === 'loading' && (
        <div className="place-info-card-state" role="status">
          <span className="place-info-card-spinner" aria-hidden="true" />
          <p>
            {L('place:googlePlaceCard.description.loadingLocationInformation')}
          </p>
        </div>
      )}

      {selection.status === 'error' && (
        <div className="place-info-card-state is-error" role="alert">
          <p>
            {L(
              'place:googlePlaceCard.description.failedLoadLocationInformation',
            )}
          </p>
          <span>
            {L(
              'place:googlePlaceCard.text.selectDifferentLocationTryAgainLater',
            )}
          </span>
        </div>
      )}

      {place && (
        <>
          <PlaceOpeningHours hours={place.openingHours} />
          <div className="place-info-card-body">
            <Rating place={place} />

            <dl className="place-info-details">
              {place.address && (
                <InfoRow
                  icon="address"
                  label={L('place:googlePlaceCard.text.address')}
                >
                  {place.address}
                </InfoRow>
              )}
              {place.website && (
                <InfoRow
                  icon="web"
                  label={L('place:googlePlaceCard.text.website')}
                >
                  <a href={place.website} target="_blank" rel="noreferrer">
                    {displayUrl(place.website)}
                  </a>
                </InfoRow>
              )}
              {place.phoneNumber && (
                <InfoRow
                  icon="phone"
                  label={L('place:googlePlaceCard.text.phoneNumber')}
                >
                  <a href={`tel:${place.phoneNumber.replace(/[^\d+]/g, '')}`}>
                    {place.phoneNumber}
                  </a>
                </InfoRow>
              )}
            </dl>

            {place.googleMapsUrl && (
              <div className="place-info-card-links">
                <a
                  className="place-info-google-link"
                  href={place.googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {L('place:googlePlaceCard.text.viewGoogleMaps')}
                  <span aria-hidden="true">↗</span>
                </a>
              </div>
            )}
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
    </MapPopupCardShell>
  );
}
