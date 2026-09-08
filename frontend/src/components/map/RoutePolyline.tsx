import { memo } from 'react';
import type { ScreenPoint } from '../../domain/map/mapTypes';
import type { TripRoute } from '../../types/trip';

type Props = {
  route: TripRoute;
  points: ScreenPoint[];
  active: boolean;
};

export const RoutePolyline = memo(function RoutePolyline({
  route,
  points,
  active,
}: Props) {
  return (
    <polyline
      className={`trip-map-route${active ? ' is-active' : ''}`}
      points={points.map(({ x, y }) => `${x},${y}`).join(' ')}
      stroke={route.color}
      vectorEffect="non-scaling-stroke"
    />
  );
});
