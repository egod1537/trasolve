import type { TripPolylineMode } from '@trasolve/shared';
import {
  formatRouteClockTime,
  formatRouteFare,
  formatRouteTransitLine,
  type RouteSegmentDetail,
  type RouteSegmentState,
  type RouteSegmentStep,
} from '@/features/map-workspace/domain/routeSegment';
import {
  formatPolylineDistance,
  formatPolylineMode,
  formatRouteDuration,
} from '@/features/map-workspace/lib/mapFormatters';
import { useL, type Localize } from '@/shared/i18n';
import '@/features/map-workspace/styles/route-segment.css';

const VEHICLE_LABELS: Readonly<Record<string, string>> = {
  BUS: '버스',
  CABLE_CAR: '케이블카',
  COMMUTER_TRAIN: '전철',
  FERRY: '페리',
  FUNICULAR: '푸니쿨라',
  GONDOLA_LIFT: '곤돌라',
  HEAVY_RAIL: '철도',
  HIGH_SPEED_TRAIN: '고속철도',
  INTERCITY_BUS: '시외버스',
  LONG_DISTANCE_TRAIN: '장거리 열차',
  METRO_RAIL: '지하철',
  MONORAIL: '모노레일',
  RAIL: '철도',
  SHARE_TAXI: '합승 택시',
  SUBWAY: '지하철',
  TRAM: '트램',
  TROLLEYBUS: '트롤리버스',
};

function formatNullableDuration(
  durationMillis: number | null,
  L: Localize,
): string {
  return durationMillis === null
    ? '시간 정보 없음'
    : formatRouteDuration(durationMillis, L);
}

function formatStepLabel(step: RouteSegmentStep, L: Localize): string {
  switch (step.kind) {
    case 'walk':
      return formatPolylineMode('walking', L);
    case 'drive':
      return formatPolylineMode('driving', L);
    case 'transit':
      return (
        (step.transit?.vehicleType &&
          VEHICLE_LABELS[step.transit.vehicleType]) ||
        formatPolylineMode('transit', L)
      );
    case 'other':
      return '이동';
  }
}

function formatErrorMessage(
  state: Extract<RouteSegmentState, { status: 'error' }>,
): string {
  switch (state.reason) {
    case 'not-found':
      return '이 구간의 경로를 찾지 못했습니다.';
    case 'timeout':
      return '경로 조회 시간이 초과됐습니다.';
    case 'network':
      return '경로 서버에 연결할 수 없습니다.';
    case 'request-failed':
      return state.message ?? '경로를 불러오지 못했습니다.';
  }
}

type MetricsProps = {
  mode: TripPolylineMode;
  state: RouteSegmentState | null;
  straightDistanceMeters: number | undefined;
  onRetry?: () => void;
};

/** Duration, distance and fare of one segment, including load/error states. */
export function RouteSegmentMetrics({
  mode,
  state,
  straightDistanceMeters,
  onRetry,
}: MetricsProps) {
  const L = useL();
  if (!state) {
    return (
      <div className="route-segment-metrics is-straight">
        <div className="route-segment-metric">
          <span>직선 거리</span>
          <strong>{formatPolylineDistance(straightDistanceMeters, L)}</strong>
        </div>
        <p className="route-segment-hint">
          도보·대중교통·자동차를 선택하면 실제 경로로 표시됩니다.
        </p>
      </div>
    );
  }

  if (state.status === 'loading') {
    return (
      <div className="route-segment-metrics is-loading" role="status">
        <span className="route-segment-spinner" aria-hidden="true" />
        <p className="route-segment-hint">실제 경로를 계산하고 있습니다.</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="route-segment-metrics is-error" role="alert">
        <p className="route-segment-error">{formatErrorMessage(state)}</p>
        <p className="route-segment-hint">
          지도에는 두 장소를 직선으로 연결해 표시합니다.
        </p>
        {onRetry && (
          <button
            type="button"
            className="route-segment-retry"
            onClick={onRetry}
          >
            {L('common:action.retry')}
          </button>
        )}
      </div>
    );
  }

  const { detail } = state;
  const fare = formatRouteFare(detail.fare);
  return (
    <div className="route-segment-metrics">
      <div className="route-segment-metric is-primary">
        <span>{L('map:tripPolylineCard.label.estimatedTravelTime')}</span>
        <strong>{formatNullableDuration(detail.durationMillis, L)}</strong>
      </div>
      <div className="route-segment-metric">
        <span>{L('map:tripPolylineCard.label.distance')}</span>
        <strong>
          {formatPolylineDistance(detail.distanceMeters ?? undefined, L)}
        </strong>
      </div>
      {mode === 'transit' && (
        <div className="route-segment-metric">
          <span>요금</span>
          <strong>{fare ?? '요금 정보 없음'}</strong>
        </div>
      )}
      {detail.warnings.length > 0 && (
        <ul className="route-segment-warnings">
          {detail.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RouteStepSummary({ step }: { step: RouteSegmentStep }) {
  const L = useL();
  const facts = [
    step.durationMillis === null
      ? null
      : formatRouteDuration(step.durationMillis, L),
    step.distanceMeters === null
      ? null
      : formatPolylineDistance(step.distanceMeters, L),
    step.transit?.stopCount ? `${step.transit.stopCount}정거장` : null,
  ].filter((value): value is string => value !== null);
  return (
    <p className="route-itinerary-facts">
      <strong>{formatStepLabel(step, L)}</strong>
      {facts.length > 0 && <span>{facts.join(' · ')}</span>}
    </p>
  );
}

function RouteTransitDetail({
  transit,
}: {
  transit: NonNullable<RouteSegmentStep['transit']>;
}) {
  const departureTime = formatRouteClockTime(transit.departureTime);
  const arrivalTime = formatRouteClockTime(transit.arrivalTime);
  return (
    <div className="route-itinerary-transit">
      <p className="route-itinerary-line">
        <span className="route-itinerary-line-badge">
          {formatRouteTransitLine(transit) ?? '노선 정보 없음'}
        </span>
        {transit.headsign && <span>{transit.headsign} 방면</span>}
      </p>
      <dl className="route-itinerary-stops">
        <div>
          <dt>승차</dt>
          <dd>
            {transit.departureStop ?? '정류장 정보 없음'}
            {departureTime && <time>{departureTime}</time>}
          </dd>
        </div>
        <div>
          <dt>하차</dt>
          <dd>
            {transit.arrivalStop ?? '정류장 정보 없음'}
            {arrivalTime && <time>{arrivalTime}</time>}
          </dd>
        </div>
      </dl>
    </div>
  );
}

type ItineraryProps = {
  detail: RouteSegmentDetail;
  fromName: string;
  toName: string;
};

/** Step-by-step itinerary between the two places of a segment. */
export function RouteSegmentItinerary({
  detail,
  fromName,
  toName,
}: ItineraryProps) {
  return (
    <ol className="route-itinerary" aria-label="경로 상세">
      <li className="route-itinerary-endpoint">
        <span className="route-itinerary-marker" aria-hidden="true" />
        <p>
          <span>출발</span>
          <strong>{fromName}</strong>
        </p>
      </li>
      {detail.steps.map((step, index) => (
        <li
          // Steps are an immutable snapshot of one route response.
          key={index}
          className={`route-itinerary-step is-${step.kind}`}
        >
          <span className="route-itinerary-marker" aria-hidden="true" />
          <div className="route-itinerary-body">
            <RouteStepSummary step={step} />
            {step.transit && <RouteTransitDetail transit={step.transit} />}
            {step.instructions.length > 0 && (
              <details className="route-itinerary-instructions">
                <summary>안내 {step.instructions.length}개</summary>
                <ol>
                  {step.instructions.map((instruction, instructionIndex) => (
                    <li key={instructionIndex}>{instruction}</li>
                  ))}
                </ol>
              </details>
            )}
          </div>
        </li>
      ))}
      <li className="route-itinerary-endpoint is-destination">
        <span className="route-itinerary-marker" aria-hidden="true" />
        <p>
          <span>도착</span>
          <strong>{toName}</strong>
        </p>
      </li>
    </ol>
  );
}
