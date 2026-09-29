import { useId, useMemo } from 'react';
import type { Trip } from '@trasolve/shared';
import {
  createTripPreviewModel,
  type TripPreviewModel,
} from '@/features/map-workspace/domain/tripPreviewViewport';
import { LocationIcon } from '@/shared/ui/icons';

type Props = {
  trip: Pick<Trip, 'days'>;
};

// 16:10 frame; the card sizes the SVG, the viewBox keeps the geometry.
const PREVIEW_WIDTH = 160;
const PREVIEW_HEIGHT = 100;
const PREVIEW_PADDING = 16;

function buildPreviewModel(trip: Pick<Trip, 'days'>): TripPreviewModel {
  try {
    return createTripPreviewModel(trip, {
      width: PREVIEW_WIDTH,
      height: PREVIEW_HEIGHT,
      padding: PREVIEW_PADDING,
    });
  } catch {
    // A broken preview must never break the card; fall back to placeholder.
    return { status: 'empty' };
  }
}

/**
 * Lightweight SVG thumbnail of a Trip's places. It creates no map instance, so
 * many cards can render at once; a static-image renderer can replace it later
 * without changing the card.
 */
export function TripMapPreview({ trip }: Props) {
  const patternId = useId();
  const model = useMemo(() => buildPreviewModel(trip), [trip]);

  if (model.status === 'empty') {
    return (
      <div className="trip-map-preview is-empty" aria-hidden="true">
        <LocationIcon />
      </div>
    );
  }

  const markerRadius =
    model.routes.reduce((count, route) => count + route.points.length, 0) > 20
      ? 2.4
      : 3.4;

  return (
    <svg
      className="trip-map-preview"
      viewBox={`0 0 ${model.width} ${model.height}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern
          id={patternId}
          width="20"
          height="20"
          patternUnits="userSpaceOnUse"
        >
          <path d="M20 0H0V20" className="trip-map-preview-grid" />
        </pattern>
      </defs>
      <rect
        width={model.width}
        height={model.height}
        fill={`url(#${patternId})`}
      />
      {model.routes.map((route) => (
        <g key={route.dayId}>
          {route.points.length > 1 && (
            <polyline
              points={route.points
                .map((point) => `${point.x},${point.y}`)
                .join(' ')}
              fill="none"
              stroke={route.color}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.8}
            />
          )}
          {route.points.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={markerRadius}
              fill={route.color}
              className="trip-map-preview-marker"
            />
          ))}
        </g>
      ))}
    </svg>
  );
}
