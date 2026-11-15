import { useLayoutEffect, useMemo } from 'react';
import type { Trip } from '@trasolve/shared';
import { useGoogleMap } from '@/map/components/GoogleMap';
import type { MapOptions } from '@/shared/types/mapTypes';

export const PREVIEW_OPTIONS: MapOptions = {
  gestureHandling: 'none',
  keyboardShortcuts: false,
  clickableIcons: false,
  disableDefaultUI: true,
  scrollwheel: false,
  maxZoom: 16,
};

export function TripPreviewContents({ trip }: { trip: Trip }) {
  const { adapter, objects, canvasRef } = useGoogleMap();
  const days = useMemo(
    () =>
      trip.days.map((day) => ({
        ...day,
        places: day.places.slice().sort((a, b) => a.order - b.order),
      })),
    [trip.days],
  );

  useLayoutEffect(() => {
    const markers = days.flatMap((day) =>
      day.places.map((place) =>
        objects.addMarker({
          layer: 'trip-preview',
          position: place.location,
          color: day.color,
        }),
      ),
    );
    const lines = days
      .filter((day) => day.places.length > 1)
      .map((day) =>
        objects.addPolyline({
          layer: 'trip-preview',
          path: day.places.map((place) => place.location),
          style: { color: day.color, width: 3, opacity: 0.75 },
        }),
      );
    return () => {
      for (const object of [...markers, ...lines]) {
        object.remove();
      }
    };
  }, [objects, days]);

  useLayoutEffect(() => {
    const points = days.flatMap((day) =>
      day.places.map((place) => place.location),
    );
    if (!points.length) {
      return;
    }
    const latitudes = points.map((point) => point.lat);
    // Remove the largest empty longitude arc to also fit trips crossing 180°.
    const longitudes = points.map((point) => point.lng).sort((a, b) => a - b);
    let gapIndex = longitudes.length - 1;
    let largestGap = longitudes[0]! + 360 - longitudes[gapIndex]!;
    for (let index = 0; index < longitudes.length - 1; index += 1) {
      const gap = longitudes[index + 1]! - longitudes[index]!;
      if (gap > largestGap) {
        largestGap = gap;
        gapIndex = index;
      }
    }
    const bounds = {
      north: Math.max(...latitudes),
      south: Math.min(...latitudes),
      west: longitudes[(gapIndex + 1) % longitudes.length]!,
      east: longitudes[gapIndex]!,
    };
    const fit = () => {
      adapter.fitBounds(bounds, { top: 24, right: 24, bottom: 40, left: 24 });
    };
    fit();
    const observer = new ResizeObserver(fit);
    if (canvasRef.current) {
      observer.observe(canvasRef.current);
    }
    return () => observer.disconnect();
  }, [adapter, canvasRef, days]);

  return null;
}
