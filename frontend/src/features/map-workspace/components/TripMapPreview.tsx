import type { Trip } from '@trasolve/shared';
import { LocationIcon } from '@/shared/ui/icons';

type Props = {
  trip: Trip;
};

const VIEW_SIZE = 100;
const PADDING = 14;

export function TripMapPreview({ trip }: Props) {
  const days = trip.days.filter((day) => day.places.length > 0);
  const points = days.flatMap((day) =>
    day.places.map((place) => place.location),
  );

  if (points.length === 0) {
    return (
      <div className="trip-map-picker-item-preview is-empty" aria-hidden="true">
        <LocationIcon />
      </div>
    );
  }

  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = maxLat - minLat || 1;
  const lngSpan = maxLng - minLng || 1;
  const span = Math.max(latSpan, lngSpan);
  const usable = VIEW_SIZE - PADDING * 2;

  const project = (point: { lat: number; lng: number }) => {
    const x = PADDING + ((point.lng - minLng) / span) * usable;
    // Latitude increases northward, SVG y increases downward.
    const y = PADDING + ((maxLat - point.lat) / span) * usable;
    return { x, y };
  };

  return (
    <svg
      className="trip-map-picker-item-preview"
      viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
      role="img"
      aria-label={`${trip.title} 경로 미리보기`}
    >
      {days.map((day) => {
        const path = day.places
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((place) => project(place.location));
        if (path.length === 0) {
          return null;
        }
        const linePoints = path
          .map((point) => `${point.x},${point.y}`)
          .join(' ');
        return (
          <g key={day.id}>
            {path.length > 1 && (
              <polyline
                points={linePoints}
                fill="none"
                stroke={day.color}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.75}
              />
            )}
            {path.map((point, index) => (
              <circle
                key={`${day.id}-${index}`}
                cx={point.x}
                cy={point.y}
                r={points.length > 20 ? 2 : 3}
                fill={day.color}
                stroke="var(--color-surface-raised, #fff)"
                strokeWidth={1}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
