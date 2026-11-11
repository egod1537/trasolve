import {
  memo,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent,
} from 'react';
import { InlineRename } from '@/shared/ui/InlineRename';
import { DayLayerMenu } from './DayLayerMenu';
import { DayColorControl } from '@/features/map-workspace/components/layer-panel/DayColorControl';
import { LayerDragHandle } from '@/features/map-workspace/components/layer-panel/LayerDragHandle';
import { LayerItemChevron } from '@/features/map-workspace/components/layer-panel/LayerItemChevron';
import { PlaceLayerItem } from '@/features/map-workspace/components/layer-panel/PlaceLayerItem';
import { PolylineLayerItem } from '@/features/map-workspace/components/layer-panel/PolylineLayerItem';
import { useL } from '@/shared/i18n';
import { DayFileImport } from '@/features/map-workspace/files/TripFileDialogs';
import {
  type DayLayerSectionProps,
  areDayLayerPropsEqual,
  resolveLayerItems,
  getDropIndicator,
  getPreviewOffset,
} from '@/features/map-workspace/components/layer-panel/dayLayerPresentation';
export { type SelectionProps } from '@/features/map-workspace/components/layer-panel/dayLayerPresentation';

export const DayLayerSection = memo(function DayLayerSection({
  day,
  expanded,
  placeDropTargetPending,
  active,
  selectedPlaceIds,
  selectedPolylineIds,
  visible,
  onActivateDay,
  onToggleExpanded,
  onSelectPlace,
  onFocusPlace,
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
  onShuffleDayPlaces,
  onRequestDeleteDay,
  onRenamePlace,
  onUpdatePlaceStyle,
  onStartPlaceNameEditing,
  onFinishPlaceNameEditing,
  onOpenPlaceDetails,
  onOpenPolylineDetails,
  validationByItemKey,
}: DayLayerSectionProps) {
  const L = useL();
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

  const layerItems = useMemo(
    () => (expanded ? resolveLayerItems(day) : []),
    [expanded, day],
  );
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
    if (nextTitle && nextTitle !== day.title) {
      onRenameDay(day.id, nextTitle);
    }
  };

  return (
    <section
      className={`day-layer-section trip-day${active ? ' is-active' : ''}${visible ? '' : ' is-hidden'}${placeDropTargetPending ? ' is-place-drop-target-pending' : ''}${dayDragging ? ' is-dragging' : ''}${dayDropIndicator ? ` is-day-drop-${dayDropIndicator}` : ''}`}
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
              onClick={() => onActivateDay(day.id)}
              disabled={!visible}
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
                ariaLabel={L('map:dayLayerSection.ariaLabel.editName', {
                  title: day.title,
                })}
                onCommit={commitTitle}
                onCancel={() => setTitleEditing(false)}
              />
              <span className="trip-day-date">{day.date}</span>
            </span>
          )}
        </h2>
        <DayLayerMenu
          day={day}
          onShuffle={onShuffleDayPlaces}
          onRequestDelete={onRequestDeleteDay}
        />
        <LayerItemChevron
          variant="day"
          expanded={expanded}
          controls={`layers-${day.id}`}
          label={L('map:dayLayerSection.text.message', {
            title: day.title,
            value: expanded
              ? L('map:dayLayerSection.text.fold')
              : L('map:dayLayerSection.text.expand'),
          })}
          onClick={() => onToggleExpanded(day.id)}
        />
      </div>
      <ol
        id={`layers-${day.id}`}
        className={`trip-layer-list${layerDropAtEmpty ? ' is-layer-drop-target-empty' : ''}`}
        hidden={!expanded}
      >
        {expanded && day.places.length === 0 && day.layerItems.length === 0 && (
          <li className="trip-day-file-action">
            <DayFileImport
              dayId={day.id}
              dayTitle={day.title}
              disabled={!visible}
            />
          </li>
        )}
        {expanded &&
          layerItems.map((renderedItem, renderedIndex) => {
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
                  fromPlace={renderedItem.fromPlace}
                  toPlace={renderedItem.toPlace}
                  selected={selectedPolylineIds.has(polyline.id)}
                  detailsOpen={detailPolylineId === polyline.id}
                  validation={validationByItemKey?.[renderedItem.key]}
                  onSelect={onSelectPolyline}
                  onOpenDetails={onOpenPolylineDetails}
                />
              );
            }

            const { place } = renderedItem;
            const placeIndex = renderedItem.index;
            const dragging =
              dragState?.sourceDayId === day.id &&
              dragState.placeId === place.id;
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
                editing={editingPlaceId === place.id}
                detailsOpen={detailPlaceId === place.id}
                routeRole={routeRole}
                validation={validationByItemKey?.[renderedItem.key]}
                onSelect={onSelectPlace}
                onFocus={onFocusPlace}
                onRename={onRenamePlace}
                onUpdatePlaceStyle={onUpdatePlaceStyle}
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
        {expanded && !day.layerItems.length && (
          <li className="trip-empty-day">
            {layerDropAtEmpty
              ? L('map:dayLayerSection.text.putHere')
              : L('map:dayLayerSection.text.thereNoRegisteredItems')}
          </li>
        )}
      </ol>
    </section>
  );
}, areDayLayerPropsEqual);
