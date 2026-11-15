import { useEffect, useRef } from 'react';
import type { Trip } from '@trasolve/shared';
import { LocationIcon } from '@/shared/ui/icons';
import { useTripPreviewPool } from './TripPreviewPool';

type Props = {
  trip: Trip;
  disabled: boolean;
  onOpen: () => void;
};

export function TripMapPreview({ trip, disabled, onOpen }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pool = useTripPreviewPool();
  const hasPlaces = trip.days.some((day) => day.places.length > 0);
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !hasPlaces) {
      return;
    }
    return pool.register(container, trip);
  }, [hasPlaces, pool, trip]);

  return (
    <div ref={containerRef} className="trip-map-picker-item-preview">
      <span className="trip-map-picker-preview-placeholder" aria-hidden="true">
        <LocationIcon />
      </span>
      <button
        type="button"
        className="trip-map-picker-preview-open"
        aria-label={trip.title}
        disabled={disabled}
        onClick={onOpen}
      />
    </div>
  );
}
