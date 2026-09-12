import { memo } from 'react';
import type { LayerSelectionModifiers } from '../../hooks/useMapUi';
import type {
  LayerValidationState,
  TripPlace,
  TripPolyline,
} from '../../domain/trip';
import { formatPolylineMode } from '../../domain/polylineMode';
import { LayerItemChevron } from './LayerItemChevron';
import { LayerItemShell } from './LayerItemShell';
import { LayerTypeIcon } from './LayerTypeIcon';
import { LayerValidationIndicator } from './LayerValidationIndicator';

type Props = {
  dayId: string;
  polyline: TripPolyline;
  isLast: boolean;
  fromPlace: TripPlace | undefined;
  toPlace: TripPlace | undefined;
  selected: boolean;
  visible: boolean;
  detailsOpen: boolean;
  validation?: LayerValidationState;
  onSelect: (id: string, modifiers: LayerSelectionModifiers) => void;
  onOpenDetails: (id: string) => void;
};

export const PolylineLayerItem = memo(function PolylineLayerItem({
  dayId,
  polyline,
  isLast,
  fromPlace,
  toPlace,
  selected,
  visible,
  detailsOpen,
  validation,
  onSelect,
  onOpenDetails,
}: Props) {
  const fromName = fromPlace?.name ?? '알 수 없는 장소';
  const toName = toPlace?.name ?? '알 수 없는 장소';
  const connectionName = `${fromName} → ${toName}`;
  const openDetails = () => {
    if (visible) onOpenDetails(polyline.id);
  };
  return (
    <LayerItemShell
      type="polyline"
      itemId={polyline.id}
      dayId={dayId}
      isLast={isLast}
      selected={selected}
      detailsOpen={detailsOpen}
      disabled={!visible}
      onOpenDetails={openDetails}
      statusIndicator={<LayerValidationIndicator validation={validation} />}
      chevron={
        <LayerItemChevron
          variant="item"
          expanded={detailsOpen}
          controls={detailsOpen ? 'layer-polyline-detail-card' : undefined}
          label={`${connectionName} 상세 ${detailsOpen ? '닫기' : '열기'}`}
          detailControl
          disabled={!visible}
          onClick={(event) => {
            event.stopPropagation();
            openDetails();
          }}
        />
      }
    >
      <button
        type="button"
        className="trip-layer-item-content trip-polyline"
        disabled={!visible}
        aria-pressed={selected}
        onClick={(event) =>
          onSelect(polyline.id, {
            additive: event.ctrlKey || event.metaKey,
            range: event.shiftKey,
          })
        }
      >
        <LayerTypeIcon type="polyline" mode={polyline.mode} />
        <span className="trip-polyline-content">
          <span className="trip-polyline-name">{connectionName}</span>
          <span className="trip-polyline-mode">
            {formatPolylineMode(polyline.mode)}
          </span>
        </span>
      </button>
    </LayerItemShell>
  );
});
