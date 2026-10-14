import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TripPolylineMode } from '@trasolve/shared';
import {
  createRouteSegmentQuery,
  isRoutableMode,
  ROUTABLE_MODES,
  type RoutableMode,
  type RouteSegmentEndpoint,
  type RouteSegmentQuery,
  type RouteSegmentState,
} from '@/features/map-workspace/domain/routeSegment';
import {
  buildRouteCandidateViewModels,
  filterAndSortTransitCandidates,
  type TransitFilter,
  type TransitSort,
} from '@/features/map-workspace/model/routeCandidateViewModel';
import {
  formatPolylineMode,
  formatRouteDuration,
} from '@/features/map-workspace/lib/mapFormatters';
import {
  useRouteSegmentSnapshot,
  useRouteSegmentStore,
} from '@/features/map-workspace/hooks/useRouteSegments';
import { PolylineModeIcon } from '@/features/map-workspace/components/PolylineModeIcon';
import { RouteCandidateCard } from '@/features/map-workspace/components/route-segment/RouteCandidateCard';
import { formatErrorMessage } from '@/features/map-workspace/components/route-segment/RouteSegmentDetails';
import { useL } from '@/shared/i18n';

type PanelPlace = RouteSegmentEndpoint & { name: string };

type Props = {
  polylineMode: TripPolylineMode;
  from: PanelPlace;
  to: PanelPlace;
  disabled: boolean;
  /** Absent in read-only views: other modes can be browsed, not chosen. */
  onUpdateMode?: (mode: TripPolylineMode) => Promise<boolean>;
};

const TRANSIT_FILTERS: ReadonlyArray<{ value: TransitFilter; label: string }> =
  [
    { value: 'all', label: '전체' },
    { value: 'bus', label: '버스' },
    { value: 'rail', label: '지하철' },
    { value: 'mixed', label: '버스+지하철' },
  ];

const TRANSIT_SORTS: ReadonlyArray<{ value: TransitSort; label: string }> = [
  { value: 'best', label: '최적 경로순' },
  { value: 'fewest-transfers', label: '최소환승순' },
  { value: 'least-walking', label: '최소도보순' },
  { value: 'fastest', label: '빠른순' },
];

type PanelStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'no-route'; message: string }
  | { kind: 'unsupported' }
  | { kind: 'error'; message: string };

function resolveStatus(
  mode: RoutableMode,
  state: RouteSegmentState | undefined,
): PanelStatus | null {
  if (!state || state.status === 'loading') {
    return { kind: 'loading' };
  }
  if (state.status === 'ready') {
    return null;
  }
  if (state.reason === 'not-found') {
    // Google returns no bicycle route where cycling directions are unavailable.
    return mode === 'bicycling'
      ? { kind: 'unsupported' }
      : { kind: 'no-route', message: formatErrorMessage(state) };
  }
  return { kind: 'error', message: formatErrorMessage(state) };
}

function formatTabDuration(
  state: RouteSegmentState | undefined,
  L: ReturnType<typeof useL>,
) {
  if (!state || state.status === 'loading') {
    return '…';
  }
  const duration =
    state.status === 'ready' ? state.candidates[0]?.durationMillis : null;
  return duration === null || duration === undefined
    ? '—'
    : formatRouteDuration(duration, L);
}

function CandidateSkeleton() {
  return (
    <ul className="route-candidate-list" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <li key={index} className="route-candidate is-skeleton">
          <span className="route-candidate-skeleton-line is-short" />
          <span className="route-candidate-skeleton-line" />
          <span className="route-candidate-skeleton-line is-bar" />
        </li>
      ))}
    </ul>
  );
}

/**
 * Naver-style route comparison for one segment: mode tabs, options and a list
 * of candidates. Selecting a candidate is session-only UI state shared with the
 * map; choosing another mode also updates the persisted segment mode.
 */
export function RouteCandidatePanel({
  polylineMode,
  from,
  to,
  disabled,
  onUpdateMode,
}: Props) {
  const L = useL();
  const store = useRouteSegmentStore();
  const snapshot = useRouteSegmentSnapshot();
  // Straight segments start idle until a mode tab is chosen.
  const [activeMode, setActiveMode] = useState<RoutableMode | null>(
    isRoutableMode(polylineMode) ? polylineMode : null,
  );
  const [transitFilter, setTransitFilter] = useState<TransitFilter>('all');
  const [transitSort, setTransitSort] = useState<TransitSort>('best');
  const [now] = useState(() => new Date());
  const {
    placeId: fromPlaceId,
    location: { lat: fromLat, lng: fromLng },
  } = from;
  const {
    placeId: toPlaceId,
    location: { lat: toLat, lng: toLng },
  } = to;

  const queries = useMemo(() => {
    const origin = {
      placeId: fromPlaceId,
      location: { lat: fromLat, lng: fromLng },
    };
    const destination = {
      placeId: toPlaceId,
      location: { lat: toLat, lng: toLng },
    };
    return Object.fromEntries(
      ROUTABLE_MODES.map((mode) => [
        mode,
        createRouteSegmentQuery(origin, destination, mode),
      ]),
    ) as Record<RoutableMode, RouteSegmentQuery>;
  }, [fromLat, fromLng, fromPlaceId, toLat, toLng, toPlaceId]);

  useEffect(() => {
    // Tabs show each mode's best time, so every mode is requested once.
    for (const mode of ROUTABLE_MODES) {
      store.ensure(queries[mode]);
    }
  }, [queries, store]);

  const activeQuery = activeMode ? queries[activeMode] : null;
  const activeState = activeQuery
    ? snapshot.states.get(activeQuery.key)
    : undefined;
  const selectedIndex = activeQuery
    ? (snapshot.selections.get(activeQuery.key) ?? 0)
    : 0;
  const status: PanelStatus | null = activeMode
    ? resolveStatus(activeMode, activeState)
    : { kind: 'idle' };
  const candidates = useMemo(() => {
    if (!activeMode || activeState?.status !== 'ready') {
      return [];
    }
    const items = buildRouteCandidateViewModels(
      activeMode,
      activeState.candidates,
      now,
    );
    return activeMode === 'transit'
      ? filterAndSortTransitCandidates(items, transitFilter, transitSort)
      : items;
  }, [activeMode, activeState, now, transitFilter, transitSort]);
  const modeMatches = polylineMode === activeMode;
  const canChangeMode = !!onUpdateMode;

  const selectCandidate = useCallback(
    (index: number) => {
      if (!activeMode || !activeQuery) {
        return;
      }
      store.select(activeQuery.key, index);
      if (!modeMatches && onUpdateMode) {
        void onUpdateMode(activeMode);
      }
    },
    [activeMode, activeQuery, modeMatches, onUpdateMode, store],
  );

  return (
    <div className="route-candidate-panel">
      <div
        className="route-candidate-tabs"
        role="tablist"
        aria-label="이동수단"
      >
        {ROUTABLE_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            role="tab"
            className="route-candidate-tab"
            aria-selected={mode === activeMode}
            onClick={() => setActiveMode(mode)}
          >
            <PolylineModeIcon mode={mode} />
            <span className="route-candidate-tab-label">
              {formatPolylineMode(mode, L)}
            </span>
            <strong>
              {formatTabDuration(snapshot.states.get(queries[mode].key), L)}
            </strong>
          </button>
        ))}
      </div>

      <div className="route-candidate-endpoints">
        <p>
          <span>출발</span>
          <strong>{from.name}</strong>
        </p>
        <p>
          <span>도착</span>
          <strong>{to.name}</strong>
        </p>
      </div>

      <div className="route-candidate-options">
        <span className="route-candidate-option-chip">지금 출발</span>
        {activeMode === 'transit' && (
          <>
            <div
              className="route-candidate-filters"
              role="group"
              aria-label="대중교통 종류"
            >
              {TRANSIT_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  className="route-candidate-filter"
                  aria-pressed={transitFilter === filter.value}
                  onClick={() => setTransitFilter(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <select
              className="route-candidate-sort"
              aria-label="정렬"
              value={transitSort}
              onChange={(event) =>
                setTransitSort(event.target.value as TransitSort)
              }
            >
              {TRANSIT_SORTS.map((sort) => (
                <option key={sort.value} value={sort.value}>
                  {sort.label}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {activeMode && !modeMatches && (
        <p className="route-candidate-hint">
          {canChangeMode
            ? `경로를 선택하면 이 구간이 ${formatPolylineMode(activeMode!, L)}(으)로 바뀝니다.`
            : `현재 이동수단은 ${formatPolylineMode(polylineMode, L)}입니다. 다른 이동수단은 비교만 할 수 있습니다.`}
        </p>
      )}

      <div
        className="route-candidate-scroll"
        aria-live="polite"
        aria-busy={status?.kind === 'loading'}
      >
        {status?.kind === 'idle' && (
          <p className="route-candidate-state">
            아직 경로 후보가 없습니다. 이동수단을 선택하면 후보 경로를 비교할 수
            있습니다.
          </p>
        )}
        {status?.kind === 'loading' && <CandidateSkeleton />}
        {status?.kind === 'no-route' && (
          <p className="route-candidate-state">{status.message}</p>
        )}
        {status?.kind === 'unsupported' && (
          <p className="route-candidate-state">
            이 지역에서는 {formatPolylineMode(activeMode!, L)} 경로를 지원하지
            않거나 경로가 없습니다.
          </p>
        )}
        {status?.kind === 'error' && (
          <div className="route-candidate-state is-error" role="alert">
            <p>{status.message}</p>
            <button
              type="button"
              className="route-segment-retry"
              onClick={() => activeQuery && store.retry(activeQuery)}
            >
              {L('common:action.retry')}
            </button>
          </div>
        )}
        {!status && candidates.length === 0 && (
          <p className="route-candidate-state">
            이 조건에 맞는 경로가 없습니다.
          </p>
        )}
        {!status && activeMode && candidates.length > 0 && (
          <ul className="route-candidate-list">
            {candidates.map((candidate) => (
              <RouteCandidateCard
                key={candidate.index}
                mode={activeMode}
                candidate={candidate}
                selected={modeMatches && candidate.index === selectedIndex}
                disabled={disabled || (!modeMatches && !canChangeMode)}
                fromName={from.name}
                toName={to.name}
                onSelect={selectCandidate}
              />
            ))}
          </ul>
        )}
      </div>

      {canChangeMode && polylineMode !== 'straight' && (
        <button
          type="button"
          className="route-candidate-straight"
          disabled={disabled}
          onClick={() => void onUpdateMode?.('straight')}
        >
          <PolylineModeIcon mode="straight" />
          {formatPolylineMode('straight', L)}(으)로 표시
        </button>
      )}
    </div>
  );
}
