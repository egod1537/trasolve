import { memo } from 'react';
import { formatClockTime, formatDurationMinutes } from '@/entities/place';
import type {
  LayerValidationState,
  TripPlace,
  TripPolyline,
} from '@/entities/trip';
import {
  TimeRangeTimeline,
  type TimeRangeTimelineRange,
} from '@/features/place-editor';
import type { LayerSelectionModifiers } from '@/features/map-workspace/model/useMapWorkspace';
import { formatPolylineMode } from '@/features/map-workspace/domain/polylineMode';
import { LayerItemChevron } from '@/features/map-workspace/components/layer-panel/LayerItemChevron';
import { LayerItemShell } from '@/features/map-workspace/components/layer-panel/LayerItemShell';
import { LayerTypeIcon } from '@/features/map-workspace/components/layer-panel/LayerTypeIcon';
import { LayerValidationIndicator } from '@/features/map-workspace/components/layer-panel/LayerValidationIndicator';

const MINUTES_PER_DAY = 24 * 60;

type PolylineScheduleRange = {
  range: TimeRangeTimelineRange;
  durationMinutes: number;
};

function parseClockMinutes(time: string | undefined): number | null {
  if (!time) {
    return null;
  }
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function getPolylineScheduleRange(
  fromPlace: TripPlace | undefined,
  toPlace: TripPlace | undefined,
): PolylineScheduleRange | null {
  const fromMinute = parseClockMinutes(fromPlace?.time);
  const toMinute = parseClockMinutes(toPlace?.time);
  const stayMinutes =
    fromPlace?.preferredDurationMinutes ?? fromPlace?.visitDurationMinutes ?? 0;
  if (
    fromMinute === null ||
    toMinute === null ||
    !Number.isInteger(stayMinutes) ||
    stayMinutes < 0
  ) {
    return null;
  }

  const start = fromMinute + stayMinutes;
  if (start >= MINUTES_PER_DAY || toMinute <= start) {
    return null;
  }
  return {
    range: { start, end: toMinute },
    durationMinutes: toMinute - start,
  };
}

type Props = {
  dayId: string;
  polyline: TripPolyline;
  isLast: boolean;
  fromPlace: TripPlace | undefined;
  toPlace: TripPlace | undefined;
  selected: boolean;
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
  detailsOpen,
  validation,
  onSelect,
  onOpenDetails,
}: Props) {
  const fromName = fromPlace?.name ?? '알 수 없는 장소';
  const toName = toPlace?.name ?? '알 수 없는 장소';
  const connectionName = `${fromName} → ${toName}`;
  const scheduleRange = getPolylineScheduleRange(fromPlace, toPlace);
  const openDetails = () => onOpenDetails(polyline.id);
  return (
    <LayerItemShell
      type="polyline"
      itemId={polyline.id}
      dayId={dayId}
      isLast={isLast}
      selected={selected}
      detailsOpen={detailsOpen}
      onOpenDetails={openDetails}
      statusIndicator={<LayerValidationIndicator validation={validation} />}
      chevron={
        <LayerItemChevron
          variant="item"
          expanded={detailsOpen}
          controls={detailsOpen ? 'layer-polyline-detail-card' : undefined}
          label={`${connectionName} 상세 ${detailsOpen ? '닫기' : '열기'}`}
          detailControl
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
            {scheduleRange
              ? ` · 장소 사이 ${formatDurationMinutes(scheduleRange.durationMinutes)}`
              : null}
          </span>
          {scheduleRange && (
            <span className="trip-polyline-time-summary">
              <TimeRangeTimeline
                ranges={[scheduleRange.range]}
                tone="travel"
                variant="compact"
                ariaLabel={`${fromName}에서 ${toName}까지 일정 구간 ${formatClockTime(scheduleRange.range.start)}부터 ${formatClockTime(scheduleRange.range.end)}까지`}
              />
            </span>
          )}
        </span>
      </button>
    </LayerItemShell>
  );
});
