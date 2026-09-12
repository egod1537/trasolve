import {
  memo,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent,
} from 'react';
import type { useDayReorder } from '../../hooks/useDayReorder';
import type { LayerSelectionModifiers } from '../../hooks/useMapUi';
import {
  type PlaceDragState,
  type usePlaceReorder,
} from '../../hooks/usePlaceReorder';
import type {
  LayerItem,
  LayerValidationByItemKey,
  TripDay,
  TripPlace,
  TripPolyline,
} from '../../domain/trip';
import { InlineRename } from './InlineRename';
import { DayColorControl } from './DayColorControl';
import { LayerDragHandle } from './LayerDragHandle';
import { LayerItemChevron } from './LayerItemChevron';
import { PlaceLayerItem } from './PlaceLayerItem';
import { PolylineLayerItem } from './PolylineLayerItem';

type ReorderControls = ReturnType<typeof usePlaceReorder>;
type DayReorderControls = ReturnType<typeof useDayReorder>;

type DropIndicator = {
  itemKey: string;
  position: 'before' | 'after';
} | null;

type RenderedLayerItem =
  | {
      type: 'place';
      key: string;
      place: TripPlace;
    }
  | {
      type: 'polyline';
      key: string;
      polyline: TripPolyline;
    };

export type SelectionProps = {
  selectedPlaceId: string | null;
  selectedPlaceIds: ReadonlySet<string>;
  selectedPolylineId: string | null;
  selectedPolylineIds: ReadonlySet<string>;
  selectedDayId: string | null;
  visibleDayIds: ReadonlySet<string>;
  onSelectPlace: (id: string, modifiers: LayerSelectionModifiers) => void;
  onSelectPlaceForDetails: (id: string) => void;
  onSelectPlaceForDrag: (id: string) => void;
  onSelectPolyline: (id: string, modifiers: LayerSelectionModifiers) => void;
  onSelectPolylineForDetails: (id: string) => void;
  onSelectDay: (id: string) => void;
  onToggleDayVisibility: (id: string) => void;
};

function getDropIndicator(
  day: TripDay,
  dragState: PlaceDragState | null,
): DropIndicator {
  if (
    !dragState ||
    dragState.targetDayId !== day.id ||
    (dragState.sourceDayId === dragState.targetDayId &&
      dragState.targetIndex === dragState.sourceIndex)
  ) {
    return null;
  }

  const stationaryPlaces = day.places.filter(
    (place) => place.id !== dragState.placeId,
  );
  const nextPlace = stationaryPlaces[dragState.targetIndex];
  if (nextPlace) {
    return { itemKey: `place:${nextPlace.id}`, position: 'before' };
  }
  const lastPlace = stationaryPlaces.at(-1);
  return lastPlace
    ? { itemKey: `place:${lastPlace.id}`, position: 'after' }
    : null;
}

function getPreviewOffset(
  dayId: string,
  placeId: string,
  dragState: PlaceDragState | null,
  dayPreviewOffset: number,
): number {
  if (!dragState) return 0;
  const dragging =
    dragState.sourceDayId === dayId && dragState.placeId === placeId;
  if (dragging) {
    return dragState.currentY - dragState.startY - dayPreviewOffset;
  }
  return 0;
}

function layerItemKey(item: LayerItem): string {
  return `${item.type}:${item.id}`;
}

export const DayLayerSection = memo(function DayLayerSection({
  day,
  expanded,
  onToggle,
  active,
  selectedPlaceIds,
  selectedPolylineIds,
  visible,
  onSelectDay,
  onSelectPlace,
  onSelectPolyline,
  onToggleDayVisibility,
  reorder,
  dayIndex,
  layerItemDayPreviewOffset,
  dayReorder,
  dayDropIndicator,
  onBeforeLayerItemDrag,
  editingPlaceId,
  detailPlaceId,
  detailPolylineId,
  onRenameDay,
  onUpdateDayColor,
  onRenamePlace,
  onStartPlaceNameEditing,
  onFinishPlaceNameEditing,
  onOpenPlaceDetails,
  onOpenPolylineDetails,
  validationByItemKey,
}: Omit<
  SelectionProps,
  | 'selectedDayId'
  | 'selectedPlaceId'
  | 'selectedPolylineId'
  | 'visibleDayIds'
  | 'onSelectPlaceForDetails'
  | 'onSelectPlaceForDrag'
  | 'onSelectPolylineForDetails'
> & {
  day: TripDay;
  active: boolean;
  visible: boolean;
  dayIndex: number;
  layerItemDayPreviewOffset: number;
  expanded: boolean;
  onToggle: (dayId: string) => void;
  reorder: ReorderControls;
  dayReorder: DayReorderControls;
  dayDropIndicator: 'before' | 'after' | null;
  onBeforeLayerItemDrag: (placeId: string) => void;
  editingPlaceId: string | null;
  detailPlaceId: string | null;
  detailPolylineId: string | null;
  onRenameDay: (dayId: string, title: string) => void;
  onUpdateDayColor: (dayId: string, color: string) => void;
  onRenamePlace: (placeId: string, name: string) => void;
  onStartPlaceNameEditing: (placeId: string) => void;
  onFinishPlaceNameEditing: (placeId: string) => void;
  onOpenPlaceDetails: (placeId: string) => void;
  onOpenPolylineDetails: (polylineId: string) => void;
  validationByItemKey?: LayerValidationByItemKey;
}) {
  const [titleEditing, setTitleEditing] = useState(false);
  const dragState = reorder.dragState;
  const dropIndicator = getDropIndicator(day, dragState);
  const dayDragState = dayReorder.dragState;
  const dayDragging = dayDragState?.dayId === day.id;
  const layerDropAtEmpty =
    !!dragState &&
    dragState.targetDayId === day.id &&
    day.layerItems.length === 0;
  let dayPreviewOffset = layerItemDayPreviewOffset;
  if (dayDragState) {
    if (dayDragging) {
      dayPreviewOffset = dayDragState.currentY - dayDragState.startY;
    } else if (
      dayDragState.sourceIndex < dayDragState.targetIndex &&
      dayIndex > dayDragState.sourceIndex &&
      dayIndex <= dayDragState.targetIndex
    ) {
      dayPreviewOffset = -dayDragState.sourceHeight;
    } else if (
      dayDragState.sourceIndex > dayDragState.targetIndex &&
      dayIndex >= dayDragState.targetIndex &&
      dayIndex < dayDragState.sourceIndex
    ) {
      dayPreviewOffset = dayDragState.sourceHeight;
    }
  }

  const layerItems = useMemo<RenderedLayerItem[]>(() => {
    const places = new Map(day.places.map((place) => [place.id, place]));
    const polylines = new Map(
      day.polylines.map((polyline) => [polyline.id, polyline]),
    );
    return day.layerItems.flatMap((item): RenderedLayerItem[] => {
      const key = layerItemKey(item);
      if (item.type === 'place') {
        const place = places.get(item.id);
        return place ? [{ type: 'place', key, place }] : [];
      }
      const polyline = polylines.get(item.id);
      return polyline ? [{ type: 'polyline', key, polyline }] : [];
    });
  }, [day.layerItems, day.places, day.polylines]);
  const placeLayerItemIds = layerItems.flatMap((item) =>
    item.type === 'place' ? [item.place.id] : [],
  );
  const startPlaceId = placeLayerItemIds[0];
  const destinationPlaceId =
    placeLayerItemIds.length > 1 ? placeLayerItemIds.at(-1) : undefined;

  const startTitleEditing = (event: MouseEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dayReorder.cancelDrag();
    setTitleEditing(true);
  };
  const commitTitle = (draft: string) => {
    const nextTitle = draft.trim();
    setTitleEditing(false);
    if (nextTitle && nextTitle !== day.title) onRenameDay(day.id, nextTitle);
  };

  return (
    <section
      className={`day-layer-section trip-day${active ? ' is-active' : ''}${visible ? '' : ' is-hidden'}${dayDragging ? ' is-dragging' : ''}${dayDropIndicator ? ` is-day-drop-${dayDropIndicator}` : ''}`}
      style={
        {
          '--day-color': day.color,
          '--day-preview-offset': `${dayPreviewOffset}px`,
        } as CSSProperties
      }
      data-day-id={day.id}
      aria-labelledby={`title-${day.id}`}
    >
      <div className="trip-day-heading">
        <LayerDragHandle
          label={day.title}
          dragging={dayDragging}
          onPointerDown={(event) =>
            dayReorder.onPointerDown(day.id, dayIndex, event)
          }
          onPointerMove={dayReorder.onPointerMove}
          onPointerUp={dayReorder.onPointerUp}
          onPointerCancel={dayReorder.onPointerCancel}
          onLostPointerCapture={dayReorder.onLostPointerCapture}
          onKeyDown={(event) => dayReorder.onKeyDown(day.id, dayIndex, event)}
        />
        <DayColorControl
          dayId={day.id}
          dayTitle={day.title}
          color={day.color}
          visible={visible}
          onToggleVisibility={onToggleDayVisibility}
          onChangeColor={onUpdateDayColor}
        />
        <h2 id={`title-${day.id}`}>
          {!titleEditing ? (
            <button
              type="button"
              aria-disabled={!visible}
              tabIndex={visible ? undefined : -1}
              onClick={() => {
                if (visible) onSelectDay(day.id);
              }}
              aria-pressed={active}
            >
              <span
                className="trip-day-title-text"
                onDoubleClick={startTitleEditing}
              >
                {day.title}
              </span>
              <span className="trip-day-date">{day.date}</span>
            </button>
          ) : (
            <span className="trip-day-title-editor">
              <InlineRename
                value={day.title}
                ariaLabel={`${day.title} 이름 수정`}
                onCommit={commitTitle}
                onCancel={() => setTitleEditing(false)}
              />
              <span className="trip-day-date">{day.date}</span>
            </span>
          )}
        </h2>
        <LayerItemChevron
          variant="day"
          expanded={expanded}
          controls={`layers-${day.id}`}
          label={`${day.title} ${expanded ? '접기' : '펼치기'}`}
          onClick={() => onToggle(day.id)}
        />
      </div>
      <ol
        id={`layers-${day.id}`}
        className={`trip-layer-list${layerDropAtEmpty ? ' is-layer-drop-target-empty' : ''}`}
        hidden={!expanded}
      >
        {layerItems.map((renderedItem, renderedIndex) => {
          const isLast = renderedIndex === layerItems.length - 1;
          const dropPosition =
            dropIndicator?.itemKey === renderedItem.key
              ? dropIndicator.position
              : null;

          if (renderedItem.type === 'polyline') {
            const { polyline } = renderedItem;
            return (
              <PolylineLayerItem
                key={renderedItem.key}
                dayId={day.id}
                polyline={polyline}
                isLast={isLast}
                fromPlace={day.places.find(
                  (place) => place.id === polyline.fromPlaceId,
                )}
                toPlace={day.places.find(
                  (place) => place.id === polyline.toPlaceId,
                )}
                selected={selectedPolylineIds.has(polyline.id)}
                visible={visible}
                detailsOpen={detailPolylineId === polyline.id}
                validation={validationByItemKey?.[renderedItem.key]}
                onSelect={onSelectPolyline}
                onOpenDetails={onOpenPolylineDetails}
              />
            );
          }

          const { place } = renderedItem;
          const placeIndex = day.places.findIndex(
            (candidate) => candidate.id === place.id,
          );
          const dragging =
            dragState?.sourceDayId === day.id && dragState.placeId === place.id;
          const previewOffset = getPreviewOffset(
            day.id,
            place.id,
            dragState,
            layerItemDayPreviewOffset,
          );
          const routeRole =
            startPlaceId === place.id
              ? 'start'
              : destinationPlaceId === place.id
                ? 'destination'
                : undefined;
          return (
            <PlaceLayerItem
              key={renderedItem.key}
              dayId={day.id}
              dayColor={day.color}
              place={place}
              index={placeIndex}
              isLast={isLast}
              selected={selectedPlaceIds.has(place.id)}
              visible={visible}
              editing={editingPlaceId === place.id}
              detailsOpen={detailPlaceId === place.id}
              routeRole={routeRole}
              validation={validationByItemKey?.[renderedItem.key]}
              onSelect={onSelectPlace}
              onRename={onRenamePlace}
              onStartNameEditing={onStartPlaceNameEditing}
              onFinishNameEditing={onFinishPlaceNameEditing}
              onOpenDetails={onOpenPlaceDetails}
              dragging={dragging}
              dropPosition={dropPosition}
              previewOffset={previewOffset}
              onBeforeDrag={onBeforeLayerItemDrag}
              onCancelDrag={reorder.cancelDrag}
              onDragPointerDown={reorder.onPointerDown}
              onDragPointerMove={reorder.onPointerMove}
              onDragPointerUp={reorder.onPointerUp}
              onDragPointerCancel={reorder.onPointerCancel}
              onDragLostPointerCapture={reorder.onLostPointerCapture}
              onDragKeyDown={reorder.onKeyDown}
            />
          );
        })}
        {!day.layerItems.length && (
          <li className="trip-empty-day">
            {layerDropAtEmpty ? '여기에 놓기' : '등록된 항목이 없습니다.'}
          </li>
        )}
      </ol>
    </section>
  );
});
