import type { CSSProperties } from 'react';
import type {
  usePlaceReorder,
  PlaceDragState,
} from '../../../hooks/usePlaceReorder';
import type { TripDay } from '../../../types/trip';
import { PlaceLayerItem, type DropIndicator } from './PlaceLayerItem';

type ReorderControls = ReturnType<typeof usePlaceReorder>;
export type SelectionProps = {
  selectedPlaceId: string | null;
  selectedDayId: string | null;
  onSelectPlace: (id: string) => void;
  onSelectDay: (id: string) => void;
};

function getDropIndicator(
  day: TripDay,
  dragState: PlaceDragState | null,
): DropIndicator {
  if (
    !dragState ||
    dragState.dayId !== day.id ||
    dragState.targetIndex === dragState.sourceIndex
  ) {
    return null;
  }

  const stationaryPlaces = day.places.filter(
    (place) => place.id !== dragState.placeId,
  );
  const nextPlace = stationaryPlaces[dragState.targetIndex];
  if (nextPlace) return { placeId: nextPlace.id, position: 'before' };

  const lastPlace = stationaryPlaces.at(-1);
  return lastPlace ? { placeId: lastPlace.id, position: 'after' } : null;
}

export function DayLayerSection({
  day,
  expanded,
  onToggle,
  selectedDayId,
  selectedPlaceId,
  onSelectDay,
  onSelectPlace,
  reorder,
}: SelectionProps & {
  day: TripDay;
  expanded: boolean;
  onToggle: () => void;
  reorder: ReorderControls;
}) {
  const dropIndicator = getDropIndicator(day, reorder.dragState);

  return (
    <section
      className={`day-layer-section trip-day${selectedDayId === day.id ? ' is-active' : ''}`}
      style={{ '--day-color': day.color } as CSSProperties}
      aria-labelledby={`title-${day.id}`}
    >
      <div className="trip-day-heading">
        <h2 id={`title-${day.id}`}>
          <button
            type="button"
            onClick={() => onSelectDay(day.id)}
            aria-pressed={selectedDayId === day.id}
          >
            <span className="trip-day-color" aria-hidden="true" />
            {day.title}
            <span className="trip-day-date">{day.date}</span>
          </button>
        </h2>
        <button
          className="trip-day-toggle"
          type="button"
          aria-expanded={expanded}
          aria-controls={`places-${day.id}`}
          aria-label={`${day.title} ${expanded ? '접기' : '펼치기'}`}
          onClick={onToggle}
        >
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            style={{ transform: expanded ? undefined : 'rotate(-90deg)' }}
          >
            <path d="m4 6 4 4 4-4" />
          </svg>
        </button>
      </div>
      <ol
        id={`places-${day.id}`}
        className="trip-place-list"
        hidden={!expanded}
      >
        {day.places.map((place, index) => (
          <PlaceLayerItem
            key={place.id}
            dayId={day.id}
            place={place}
            index={index}
            selected={selectedPlaceId === place.id}
            onSelect={onSelectPlace}
            reorder={reorder}
            dropIndicator={dropIndicator}
          />
        ))}
        {!day.places.length && (
          <li className="trip-empty-day">등록된 장소가 없습니다.</li>
        )}
      </ol>
    </section>
  );
}
