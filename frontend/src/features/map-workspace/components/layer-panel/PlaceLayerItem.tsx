import { memo, type MouseEvent } from 'react';
import type { PlaceStyle } from '@trasolve/shared';
import type { usePlaceReorder } from '@/features/map-workspace/hooks/usePlaceReorder';
import type { LayerSelectionModifiers } from '@/features/map-workspace/model/useMapWorkspace';
import type { LayerValidationState, TripPlace } from '@/entities/trip';
import { formatDurationMinutes } from '@/entities/place';
import { resolvePlaceStyle } from '@/entities/place';
import { PlaceTimeTimeline } from '@/features/place-editor';
import { InlineRename } from '@/shared/ui/InlineRename';
import { LayerDragHandle } from '@/features/map-workspace/components/layer-panel/LayerDragHandle';
import { LayerItemChevron } from '@/features/map-workspace/components/layer-panel/LayerItemChevron';
import { LayerItemShell } from '@/features/map-workspace/components/layer-panel/LayerItemShell';
import { LayerValidationIndicator } from '@/features/map-workspace/components/layer-panel/LayerValidationIndicator';
import { PlaceStyleControl } from '@/features/place-editor';

type ReorderControls = ReturnType<typeof usePlaceReorder>;
type RouteRole = 'start' | 'destination';

type Props = {
  dayId: string;
  dayColor: string;
  place: TripPlace;
  index: number;
  isLast: boolean;
  selected: boolean;
  editing: boolean;
  detailsOpen: boolean;
  routeRole?: RouteRole;
  validation?: LayerValidationState;
  onSelect: (id: string, modifiers: LayerSelectionModifiers) => void;
  onRename: (id: string, name: string) => void;
  onUpdatePlaceStyle: (id: string, style: PlaceStyle) => void;
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
  editing,
  detailsOpen,
  routeRole,
  validation,
  onSelect,
  onRename,
  onUpdatePlaceStyle,
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
        {place.preferredDurationMinutes !== undefined && (
          <span className="trip-place-stay-duration">
            체류 {formatDurationMinutes(place.preferredDurationMinutes)}
          </span>
        )}
      </span>
      <PlaceTimeTimeline
        time={place.time}
        visitDurationMinutes={place.visitDurationMinutes}
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
      <PlaceStyleControl
        placeId={place.id}
        placeName={place.name}
        style={placeStyle}
        visible
        busy={false}
        triggerLabel={`${place.name} 아이콘 및 색상 변경`}
        onChangeStyle={onUpdatePlaceStyle}
      />
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
          aria-pressed={selected}
          onClick={(event) => {
            onSelect(place.id, {
              additive: event.ctrlKey || event.metaKey,
              range: event.shiftKey,
            });
          }}
        >
          {content}
        </button>
      )}
    </LayerItemShell>
  );
});
