import { memo } from 'react';
import { formatClockTime } from '@/entities/place';
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
import {
  formatPolylineDistance,
  formatPolylineMode,
  formatRouteDuration,
} from '@/features/map-workspace/lib/mapFormatters';
import {
  usePolylineRouteQuery,
  useRouteSegment,
  type RouteSegmentView,
} from '@/features/map-workspace/hooks/useRouteSegments';
import { LayerItemChevron } from '@/features/map-workspace/components/layer-panel/LayerItemChevron';
import { LayerItemShell } from '@/features/map-workspace/components/layer-panel/LayerItemShell';
import { LayerTypeIcon } from '@/features/map-workspace/components/layer-panel/LayerTypeIcon';
import { LayerValidationIndicator } from '@/features/map-workspace/components/layer-panel/LayerValidationIndicator';
import { useL, type Localize } from '@/shared/i18n';
import { formatDurationMinutes } from '@/shared/i18n/formatters';

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

/** Compact row summary of the selected candidate: time and line or distance. */
function formatRouteSummary(
  view: RouteSegmentView | null,
  L: Localize,
): string | null {
  if (!view) {
    return null;
  }
  if (view.state.status === 'loading') {
    return '경로 계산 중';
  }
  if (!view.selected) {
    return '경로 없음';
  }
  const { durationMillis, distanceMeters, steps } = view.selected;
  const lines = steps
    .map((step) => step.transit?.lineShortName ?? step.transit?.lineName)
    .filter((name): name is string => !!name);
  return [
    durationMillis === null ? null : formatRouteDuration(durationMillis, L),
    lines.length > 0
      ? lines.join(' → ')
      : distanceMeters === null
        ? null
        : formatPolylineDistance(distanceMeters, L),
  ]
    .filter((value): value is string => value !== null)
    .join(' · ');
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
  const L = useL();
  const fromName =
    fromPlace?.name ?? L('map:polylineLayerItem.fromName.text.unknownPlace');
  const toName =
    toPlace?.name ?? L('map:polylineLayerItem.fromName.text.unknownPlace');
  const connectionName = `${fromName} → ${toName}`;
  const scheduleRange = getPolylineScheduleRange(fromPlace, toPlace);
  const openDetails = () => onOpenDetails(polyline.id);
  const routeQuery = usePolylineRouteQuery(
    fromPlace && {
      placeId: fromPlace.placeId,
      location: { lat: fromPlace.lat, lng: fromPlace.lng },
    },
    toPlace && {
      placeId: toPlace.placeId,
      location: { lat: toPlace.lat, lng: toPlace.lng },
    },
    polyline.mode,
  );
  const routeView = useRouteSegment(routeQuery);
  const routeSummary = formatRouteSummary(routeView, L);
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
          label={L('map:polylineLayerItem.text.details', {
            connectionName: connectionName,
            value: detailsOpen
              ? L('common:action.close')
              : L('map:placeLayerItem.text.open'),
          })}
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
          <span
            className={`trip-polyline-mode${
              routeView?.state.status === 'error' ? ' is-route-error' : ''
            }`}
          >
            {formatPolylineMode(polyline.mode, L)}
            {routeSummary && ` · ${routeSummary}`}
            {scheduleRange
              ? L('map:polylineLayerItem.text.betweenPlaces', {
                  formatDurationMinutes: formatDurationMinutes(
                    scheduleRange.durationMinutes,
                    L,
                  ),
                })
              : null}
          </span>
          {scheduleRange && (
            <span className="trip-polyline-time-summary">
              <TimeRangeTimeline
                ranges={[scheduleRange.range]}
                tone="travel"
                variant="compact"
                ariaLabel={L('map:polylineLayerItem.ariaLabel.fromFrom', {
                  fromName: fromName,
                  toName: toName,
                  formatClockTime: formatClockTime(scheduleRange.range.start),
                })}
              />
            </span>
          )}
        </span>
      </button>
    </LayerItemShell>
  );
});
