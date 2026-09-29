import { useState } from 'react';
import { buildTripPreviewApiRoute, type Trip } from '@trasolve/shared';
import { TripMapPreview } from '@/features/map-workspace/components/TripMapPreview';

type Props = {
  trip: Pick<Trip, 'id' | 'updatedAt' | 'days'>;
};

type ImageState = 'loading' | 'loaded' | 'failed';

function hasPlaces(trip: Pick<Trip, 'days'>): boolean {
  return trip.days.some((day) => day.places.length > 0);
}

/**
 * Server-rendered map thumbnail (Maps Static API through the Trasolve backend).
 * The SVG preview stays underneath until the image loads and remains visible
 * if the image is unavailable, e.g. when no server key is configured.
 */
export function TripStaticMapPreview({ trip }: Props) {
  const [state, setState] = useState<ImageState>('loading');
  const src = buildTripPreviewApiRoute(trip.id, trip.updatedAt);
  const [loadedSrc, setLoadedSrc] = useState(src);
  // A new version (edited Trip) retries the image even after a failure.
  if (loadedSrc !== src) {
    setLoadedSrc(src);
    setState('loading');
  }

  return (
    <div className="trip-map-preview-stack">
      <TripMapPreview trip={trip} />
      {hasPlaces(trip) && state !== 'failed' && (
        <img
          className={`trip-map-preview-image${state === 'loaded' ? ' is-loaded' : ''}`}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setState('loaded')}
          onError={() => setState('failed')}
        />
      )}
    </div>
  );
}
