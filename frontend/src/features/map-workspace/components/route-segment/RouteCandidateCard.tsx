import { useId, useState } from 'react';
import {
  formatRouteFare,
  type RoutableMode,
} from '@/features/map-workspace/domain/routeSegment';
import {
  formatPolylineDistance,
  formatPolylineMode,
  formatRouteDuration,
} from '@/features/map-workspace/lib/mapFormatters';
import type {
  RouteCandidateLabel,
  RouteCandidateSegment,
  RouteCandidateViewModel,
} from '@/features/map-workspace/model/routeCandidateViewModel';
import {
  RouteSegmentItinerary,
  VEHICLE_LABELS,
  formatNullableDuration,
} from '@/features/map-workspace/components/route-segment/RouteSegmentDetails';
import { getLanguage, useL } from '@/shared/i18n';

const LABEL_TEXT: Record<RouteCandidateLabel, string> = {
  recommended: '추천',
  fastest: '최단시간',
  'fewest-transfers': '최소환승',
  'least-walking': '최소도보',
  shortest: '최단거리',
};

const SEGMENT_FALLBACK_COLORS: Record<RouteCandidateSegment['kind'], string> = {
  walk: '#9ca3af',
  transit: '#7c3aed',
  drive: '#ea580c',
  bicycle: '#0e7490',
  other: '#9ca3af',
};

/** Extra values the provider does not return yet keep a visible slot. */
const PENDING_DETAILS: Partial<Record<RoutableMode, string>> = {
  transit: '실시간 도착·교통패스 적용 여부는 아직 제공되지 않습니다.',
  driving: '통행료·연료비·택시비는 아직 제공되지 않습니다.',
  walking: '횡단보도·계단·지하도 정보는 아직 제공되지 않습니다.',
  bicycling: '자전거도로 우선 여부는 아직 제공되지 않습니다.',
};

function formatClock(date: Date): string {
  return new Intl.DateTimeFormat(getLanguage(), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function SegmentBar({
  segments,
}: {
  segments: readonly RouteCandidateSegment[];
}) {
  const L = useL();
  if (segments.length === 0) {
    return null;
  }
  return (
    <div className="route-candidate-bar" aria-hidden="true">
      {segments.map((segment, index) => {
        const background =
          segment.color ?? SEGMENT_FALLBACK_COLORS[segment.kind];
        const label =
          segment.kind === 'transit'
            ? (segment.lineName ??
              (segment.vehicleType && VEHICLE_LABELS[segment.vehicleType]) ??
              formatPolylineMode('transit', L))
            : null;
        return (
          <span
            key={index}
            className={`route-candidate-bar-segment is-${segment.kind}`}
            style={{
              flexGrow: segment.ratio,
              background,
              color: segment.textColor ?? '#ffffff',
            }}
          >
            {label && segment.ratio > 0.14 ? label : null}
          </span>
        );
      })}
    </div>
  );
}

type Props = {
  mode: RoutableMode;
  candidate: RouteCandidateViewModel;
  selected: boolean;
  disabled: boolean;
  fromName: string;
  toName: string;
  onSelect: (index: number) => void;
};

/** One comparable route candidate: key numbers, flow and expandable detail. */
export function RouteCandidateCard({
  mode,
  candidate,
  selected,
  disabled,
  fromName,
  toName,
  onSelect,
}: Props) {
  const L = useL();
  const [expanded, setExpanded] = useState(false);
  const detailId = useId();
  const fare = mode === 'transit' ? formatRouteFare(candidate.fare) : null;
  const facts = [
    candidate.distanceMeters === null
      ? null
      : formatPolylineDistance(candidate.distanceMeters, L),
    mode === 'transit' ? (fare ?? '요금 정보 없음') : null,
    mode === 'transit' && candidate.lineNames.length > 0
      ? candidate.transfers > 0
        ? `환승 ${candidate.transfers}회`
        : '환승 없음'
      : null,
    mode === 'transit' && candidate.walkingMillis > 0
      ? `도보 ${formatRouteDuration(candidate.walkingMillis, L)}`
      : null,
    candidate.estimatedSteps === null
      ? null
      : `약 ${candidate.estimatedSteps.toLocaleString(getLanguage())}걸음`,
  ].filter((value): value is string => value !== null);
  const summary =
    candidate.lineNames.length > 0
      ? candidate.lineNames.join(' → ')
      : candidate.description;

  return (
    <li
      className={`route-candidate${selected ? ' is-selected' : ''}${
        disabled ? ' is-disabled' : ''
      }`}
    >
      <button
        type="button"
        className="route-candidate-main"
        aria-pressed={selected}
        disabled={disabled}
        onClick={() => onSelect(candidate.index)}
      >
        {candidate.labels.length > 0 && (
          <span className="route-candidate-labels">
            {candidate.labels.map((label) => (
              <span key={label} className={`route-candidate-label is-${label}`}>
                {LABEL_TEXT[label]}
              </span>
            ))}
          </span>
        )}
        <span className="route-candidate-headline">
          <strong>{formatNullableDuration(candidate.durationMillis, L)}</strong>
          {candidate.arrivalAt && (
            <span>{formatClock(candidate.arrivalAt)} 도착</span>
          )}
        </span>
        {facts.length > 0 && (
          <span className="route-candidate-facts">{facts.join(' · ')}</span>
        )}
        {mode === 'transit' && <SegmentBar segments={candidate.segments} />}
        {summary && <span className="route-candidate-summary">{summary}</span>}
      </button>
      <button
        type="button"
        className="route-candidate-toggle"
        aria-expanded={expanded}
        aria-controls={detailId}
        onClick={() => setExpanded((open) => !open)}
      >
        {expanded ? '접기' : '상세보기'}
      </button>
      {expanded && (
        <div id={detailId} className="route-candidate-detail">
          <RouteSegmentItinerary
            detail={candidate.detail}
            fromName={fromName}
            toName={toName}
          />
          {PENDING_DETAILS[mode] && (
            <p className="route-candidate-pending">{PENDING_DETAILS[mode]}</p>
          )}
        </div>
      )}
    </li>
  );
}
