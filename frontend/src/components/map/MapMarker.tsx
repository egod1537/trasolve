import { memo, type CSSProperties } from 'react';
import type { ScreenPoint } from '../../domain/map/mapTypes';
import type { TripPlace } from '../../types/trip';

type Props = {
  place: TripPlace;
  dayTitle: string;
  color: string;
  selected: boolean;
  position: ScreenPoint;
  onSelect: (placeId: string) => void;
};

export const MapMarker = memo(function MapMarker({
  place,
  dayTitle,
  color,
  selected,
  position,
  onSelect,
}: Props) {
  const style = {
    '--day-color': color,
    left: position.x,
    top: position.y,
    zIndex: selected ? 1000 : place.order,
  } as CSSProperties;

  return (
    <button
      type="button"
      className={`trip-map-marker${selected ? ' is-selected' : ''}`}
      style={style}
      title={`${dayTitle} · ${place.order}. ${place.name}`}
      aria-label={`${dayTitle}의 ${place.order}번째 장소, ${place.name}`}
      aria-pressed={selected}
      onClick={() => onSelect(place.id)}
    >
      {place.order}
    </button>
  );
});
