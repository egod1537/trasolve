import type { PlaceDetails } from '@trasolve/shared';
import { useL } from '@/shared/i18n';
import type { PlaceDetailPlace } from '../model/placeDetailTypes';

type Props = {
  place: PlaceDetailPlace;
  googlePlace: PlaceDetails | null;
};
export function PlaceDetailLocation({ place, googlePlace }: Props) {
  const L = useL();
  if (!place.address && !googlePlace?.address && !googlePlace?.googleMapsUrl) {
    return null;
  }
  return (
    <section className="trip-place-management-section">
      <h3>{L('place:googlePlaceCard.tooltip.locationInformation')}</h3>
      {(place.address || googlePlace?.address) && (
        <p className="trip-place-address">
          {googlePlace?.address ?? place.address}
        </p>
      )}
      {googlePlace?.googleMapsUrl && (
        <a
          className="trip-place-google-maps-link"
          href={googlePlace.googleMapsUrl}
          target="_blank"
          rel="noreferrer"
        >
          {L('place:googlePlaceCard.text.viewGoogleMaps')}
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14 5h5v5M19 5l-8 8M18 13v6H5V6h6" />
          </svg>
        </a>
      )}
    </section>
  );
}
