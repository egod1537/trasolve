import { memo, type CSSProperties, type MouseEvent } from 'react';
import type { usePlaceReorder } from '../../hooks/usePlaceReorder';
import type { LayerSelectionModifiers } from '../../hooks/useMapUi';
import type { LayerValidationState, TripPlace } from '../../domain/trip';
import { resolvePlaceStyle } from '../../domain/placeStyle';
import { PlaceStyleIcon } from '../PlaceStyleIcon';
import { PlaceTimeTimeline } from '../PlaceTimeTimeline';
import { InlineRename } from './InlineRename';
import { LayerDragHandle } from './LayerDragHandle';
import { LayerItemChevron } from './LayerItemChevron';
import { LayerItemShell } from './LayerItemShell';
import { LayerValidationIndicator } from './LayerValidationIndicator';

type ReorderControls = ReturnType<typeof usePlaceReorder>;
type RouteRole = 'start' | 'destination';

type Props = {
  dayId: string;
  dayColor: string;
  place: TripPlace;
  index: number;
  isLast: boolean;
  selected: boolean;
  visible: boolean;
  editing: boolean;
  detailsOpen: boolean;
  routeRole?: RouteRole;
  validation?: LayerValidationState;
  onSelect: (id: string, modifiers: LayerSelectionModifiers) => void;
  onRename: (id: string, name: string) => void;
  onStartNameEditing: (id: string) => void;
  onFinishNameEditing: (id: string) => void;
  onOpenDetails: (id: string) => void;
  dragging: boolean;
  dropPosition: 'before' | 'after' | null;
  previewOffset: number;
  onBeforeDrag: (id: string) => void;
  onCancelDrag: ReorderControls['cancelDrag'];
  onDragPointerDown: ReorderControls['onPointerDown'];
  onDragPointerMove: ReorderControls['onPointerMove'];
  onDragPointerUp: ReorderControls['onPointerUp'];
  onDragPointerCancel: ReorderControls['onPointerCancel'];
  onDragLostPointerCapture: ReorderControls['onLostPointerCapture'];
  onDragKeyDown: ReorderControls['onKeyDown'];
};

export const PlaceLayerItem = memo(function PlaceLayerItem({
  dayId,
  dayColor,
  place,
  index,
  isLast,
  selected,
  visible,
  editing,
  detailsOpen,
  routeRole,
  validation,
  onSelect,
  onRename,
  onStartNameEditing,
  onFinishNameEditing,
  onOpenDetails,
  dragging,
  dropPosition,
  previewOffset,
  onBeforeDrag,
  onCancelDrag,
  onDragPointerDown,
  onDragPointerMove,
  onDragPointerUp,
  onDragPointerCancel,
  onDragLostPointerCapture,
  onDragKeyDown,
}: Props) {
  const placeStyle = resolvePlaceStyle(place.placeStyle, dayColor);
  const startNameEditing = (event: MouseEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onCancelDrag();
    onStartNameEditing(place.id);
  };
  const commitName = (draft: string) => {
    const nextName = draft.trim();
    onFinishNameEditing(place.id);
    if (nextName && nextName !== place.name) {
      onRename(place.id, nextName);
    }
  };
  const finishNameEditing = () => onFinishNameEditing(place.id);
  const openDetails = () => {
    if (!visible) {
      return;
    }
    onCancelDrag();
    onOpenDetails(place.id);
  };

  const content = (
    <span className="trip-place-content">
      <span className="trip-place-name-row">
        {editing ? (
          <InlineRename
            value={place.name}
            ariaLabel={`${place.name} 이름 수정`}
            className="trip-place-name-input"
            onCommit={commitName}
            onCancel={finishNameEditing}
          />
        ) : (
          <span className="trip-place-name" onDoubleClick={startNameEditing}>
            {place.name}
          </span>
        )}
        {routeRole && (
          <span className="sr-only">
            {routeRole === 'start' ? '출발 장소' : '도착 장소'}
          </span>
        )}
      </span>
      <PlaceTimeTimeline
        time={place.time}
        durationMinutes={place.durationMinutes}
        openingHours={place.openingHours}
        variant="compact"
      />
    </span>
  );

  return (
    <LayerItemShell
      type="place"
      itemId={place.id}
      dayId={dayId}
      isLast={isLast}
      selected={selected}
      detailsOpen={detailsOpen}
      disabled={!visible}
      dragging={dragging}
      dropPosition={dropPosition}
      previewOffset={previewOffset}
      treeNodeVariant={routeRole}
      onOpenDetails={openDetails}
      statusIndicator={<LayerValidationIndicator validation={validation} />}
      chevron={
        <LayerItemChevron
          variant="item"
          expanded={detailsOpen}
          controls={detailsOpen ? 'layer-place-detail-card' : undefined}
          label={`${place.name} 상세 ${detailsOpen ? '닫기' : '열기'}`}
          detailControl
          disabled={!visible}
          onClick={(event) => {
            event.stopPropagation();
            openDetails();
          }}
        />
      }
      dragHandle={
        <LayerDragHandle
          label={place.name}
          dragging={dragging}
          onPointerDown={(event) => {
            if (event.isPrimary && event.button === 0) {
              onBeforeDrag(place.id);
            }
            onDragPointerDown(dayId, place.id, index, event);
          }}
          onPointerMove={onDragPointerMove}
          onPointerUp={onDragPointerUp}
          onPointerCancel={onDragPointerCancel}
          onLostPointerCapture={onDragLostPointerCapture}
          onKeyDown={(event) => {
            if (
              event.altKey &&
              (event.key === 'ArrowUp' || event.key === 'ArrowDown')
            ) {
              onBeforeDrag(place.id);
            }
            onDragKeyDown(dayId, place.id, index, event);
          }}
        />
      }
    >
      <span
        className="trip-place-style-marker"
        style={{ '--place-color': placeStyle.color } as CSSProperties}
        aria-hidden="true"
      >
        <span className="trip-place-style-icon-frame">
          <PlaceStyleIcon type={placeStyle.type} />
        </span>
      </span>
      {editing ? (
        <div
          className={`trip-layer-item-content trip-place is-editing${selected ? ' is-selected' : ''}`}
        >
          {content}
        </div>
      ) : (
        <button
          type="button"
          className={`trip-layer-item-content trip-place${selected ? ' is-selected' : ''}${dragging ? ' is-dragging' : ''}`}
          aria-disabled={!visible}
          tabIndex={visible ? undefined : -1}
          aria-pressed={selected}
          onClick={(event) => {
            if (visible) {
              onSelect(place.id, {
                additive: event.ctrlKey || event.metaKey,
                range: event.shiftKey,
              });
            }
          }}
        >
          {content}
        </button>
      )}
    </LayerItemShell>
  );
});
