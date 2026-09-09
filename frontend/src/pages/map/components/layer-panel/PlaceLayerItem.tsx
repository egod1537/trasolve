import type { usePlaceReorder } from '../../hooks/usePlaceReorder';
import type { TripPlace } from '../../domain/trip';
import { PlaceDragHandle } from './PlaceDragHandle';

type ReorderControls = ReturnType<typeof usePlaceReorder>;
export type DropIndicator = {
  placeId: string;
  position: 'before' | 'after';
} | null;

export function PlaceLayerItem({
  dayId,
  place,
  index,
  selected,
  onSelect,
  reorder,
  dropIndicator,
}: {
  dayId: string;
  place: TripPlace;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
  reorder: ReorderControls;
  dropIndicator: DropIndicator;
}) {
  const dragging =
    reorder.dragState?.dayId === dayId &&
    reorder.dragState.placeId === place.id;
  const indicatorPosition =
    dropIndicator?.placeId === place.id ? dropIndicator.position : null;

  return (
    <li
      className={`place-layer-item trip-place-item${selected ? ' is-selected' : ''}${dragging ? ' is-dragging' : ''}${indicatorPosition ? ` is-drop-${indicatorPosition}` : ''}`}
      data-day-id={dayId}
      data-place-id={place.id}
    >
      <PlaceDragHandle
        placeName={place.name}
        dragging={dragging}
        onPointerDown={(event) =>
          reorder.onPointerDown(dayId, place.id, index, event)
        }
        onPointerMove={reorder.onPointerMove}
        onPointerUp={reorder.onPointerUp}
        onPointerCancel={reorder.onPointerCancel}
        onLostPointerCapture={reorder.onLostPointerCapture}
        onKeyDown={(event) => reorder.onKeyDown(dayId, place.id, index, event)}
      />
      <button
        type="button"
        className={`trip-place${selected ? ' is-selected' : ''}${dragging ? ' is-dragging' : ''}`}
        aria-pressed={selected}
        onClick={() => onSelect(place.id)}
      >
        <span className="trip-place-order" aria-hidden="true">
          {place.order}
        </span>
        <span className="trip-place-content">
          <span className="trip-place-name">{place.name}</span>
          <span className="trip-place-description">{place.description}</span>
        </span>
        {place.time && <time className="trip-place-time">{place.time}</time>}
      </button>
    </li>
  );
}
