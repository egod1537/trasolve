import type {
  TrouteOptimizeResponse,
  TrouteSolverCandidate,
  TripDay,
  TripPlace,
} from '@trasolve/shared';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  optimizeDayRoute,
  type RouteOptimizationProgress,
} from '@/features/route-optimization/api/routeOptimizationApi';
import {
  createRouteOptimizationRequest,
  getAlgorithmLabel,
  getCandidateForAlgorithm,
  getOptimizationCandidates,
  getRouteOptimizationIssue,
  isApplicableCandidate,
  isTimedOut,
  ROUTE_OPTIMIZATION_ALGORITHMS,
} from '@/features/route-optimization/model/routeOptimization';
import { useRouteGeometry } from '@/features/route-optimization/model/useRouteGeometry';
import { RouteComparisonMap } from '@/features/route-optimization/ui/RouteComparisonMap';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { IconButton } from '@/shared/ui/IconButton';
import { CloseIcon } from '@/shared/ui/icons';

type Props = {
  id: string;
  activeDay: TripDay;
  onClose: () => void;
  onApply: (dayId: string, placeIds: readonly string[]) => Promise<boolean>;
};

type RunState = 'idle' | 'running' | 'ready' | 'error';

const resultCache = new Map<string, TrouteOptimizeResponse>();

export function RouteOptimizationModal({
  id,
  activeDay,
  onClose,
  onApply,
}: Props) {
  const titleId = useId();
  const descriptionId = useId();
  const requestAbortRef = useRef<AbortController | null>(null);
  const autoRunKeyRef = useRef<string | null>(null);
  const dayKey = createDayKey(activeDay);
  const cachedResult = resultCache.get(dayKey) ?? null;
  const [response, setResponse] = useState<TrouteOptimizeResponse | null>(
    cachedResult,
  );
  const [runState, setRunState] = useState<RunState>(
    cachedResult ? 'ready' : 'idle',
  );
  const [progress, setProgress] = useState<RouteOptimizationProgress | null>(
    null,
  );
  const [selectedAlgorithmKey, setSelectedAlgorithmKey] =
    useState<string>('best');
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const inputIssue = getRouteOptimizationIssue(activeDay);
  const candidates = useMemo(
    () => (response ? getOptimizationCandidates(response) : []),
    [response],
  );
  const selectedAlgorithm =
    ROUTE_OPTIMIZATION_ALGORITHMS.find(
      (algorithm) => algorithm.key === selectedAlgorithmKey,
    ) ?? ROUTE_OPTIMIZATION_ALGORITHMS[0]!;
  const selectedCandidate = getCandidateForAlgorithm(
    selectedAlgorithm,
    candidates,
  );
  const beforePlaces = useMemo(
    () => [...activeDay.places].sort((left, right) => left.order - right.order),
    [activeDay.places],
  );
  const afterPlaces = useMemo(
    () =>
      selectedCandidate
        ? orderPlaces(beforePlaces, selectedCandidate.route)
        : [],
    [beforePlaces, selectedCandidate],
  );
  const beforeGeometry = useRouteGeometry(beforePlaces);
  const afterGeometry = useRouteGeometry(afterPlaces);
  const canApply = isApplicableCandidate(selectedCandidate, activeDay);

  const runOptimization = useCallback(async () => {
    if (inputIssue || runState === 'running') {
      return;
    }
    requestAbortRef.current?.abort();
    const controller = new AbortController();
    requestAbortRef.current = controller;
    setRunState('running');
    setProgress({
      status: 'pending',
      stage: 'accepted',
      progress: 0,
      last_message: '최적화 요청을 전송하고 있습니다.',
    });
    setError(null);
    try {
      const result = await optimizeDayRoute(
        createRouteOptimizationRequest(activeDay),
        setProgress,
        controller.signal,
      );
      if (controller.signal.aborted) {
        return;
      }
      cacheResult(dayKey, result);
      setResponse(result);
      setRunState('ready');
      setSelectedAlgorithmKey('best');
    } catch (cause: unknown) {
      if (controller.signal.aborted) {
        return;
      }
      setRunState('error');
      setError(
        cause instanceof Error
          ? cause.message
          : '경로 최적화 요청에 실패했습니다.',
      );
    }
  }, [activeDay, dayKey, inputIssue, runState]);

  useEffect(() => {
    if (
      inputIssue ||
      response ||
      runState !== 'idle' ||
      autoRunKeyRef.current === dayKey
    ) {
      return;
    }
    autoRunKeyRef.current = dayKey;
    void runOptimization();
  }, [dayKey, inputIssue, response, runOptimization, runState]);

  useEffect(
    () => () => {
      requestAbortRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    const interceptGlobalKeyDown = (event: KeyboardEvent) => {
      const isQuickSearchShortcut =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.key.toLocaleLowerCase() === 'k';
      const isSearchModeShortcut =
        event.altKey && ['1', '2', '3'].includes(event.key);
      if (isQuickSearchShortcut || isSearchModeShortcut) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener('keydown', interceptGlobalKeyDown, true);
    return () =>
      window.removeEventListener('keydown', interceptGlobalKeyDown, true);
  }, []);

  const applyCandidate = async () => {
    if (!canApply || applying) {
      return;
    }
    setApplying(true);
    setError(null);
    try {
      const applied = await onApply(activeDay.id, selectedCandidate.route);
      if (!applied) {
        setError('선택한 최적화 결과를 Day에 적용하지 못했습니다.');
        return;
      }
      onClose();
    } catch {
      setError('선택한 최적화 결과를 Day에 적용하지 못했습니다.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog
      id={id}
      className="route-optimization-modal"
      backdropClassName="route-optimization-modal-backdrop"
      labelledBy={titleId}
      describedBy={descriptionId}
      busy={runState === 'running' || applying}
      closeOnBackdrop={!applying}
      closeOnEscape={!applying}
      onClose={onClose}
    >
      <header className="route-optimization-modal-header">
        <div>
          <h2 id={titleId}>경로 최적화</h2>
          <p id={descriptionId}>
            알고리즘별 방문 순서와 실제 지도 경로를 비교합니다.
          </p>
          <strong>
            {activeDay.title} · {activeDay.places.length}개 장소
          </strong>
        </div>
        <IconButton
          className="route-optimization-modal-close"
          aria-label="경로 최적화 닫기"
          icon={<CloseIcon />}
          variant="ghost"
          size="sm"
          disabled={applying}
          onClick={onClose}
        />
      </header>

      <div className="route-optimization-modal-body">
        <AlgorithmList
          candidates={candidates}
          selectedKey={selectedAlgorithm.key}
          running={runState === 'running'}
          onSelect={setSelectedAlgorithmKey}
        />

        <main className="route-optimization-result">
          <CandidateSummary candidate={selectedCandidate} />

          {inputIssue ? (
            <EmptyResult message={inputIssue} />
          ) : !response ? (
            <EmptyResult
              loading={runState === 'running'}
              message={
                runState === 'running'
                  ? (progress?.last_message ?? '알고리즘을 실행하고 있습니다.')
                  : (error ?? '최적화 결과가 없습니다.')
              }
            />
          ) : !selectedCandidate ? (
            <EmptyResult message="이 알고리즘의 실행 결과가 없습니다." />
          ) : (
            <>
              <div className="route-optimization-map-grid">
                <RouteComparisonMap
                  title="Before"
                  ariaLabel="현재 방문 순서 지도"
                  layer="route-optimization-before"
                  color="#64748b"
                  places={beforePlaces}
                  geometry={beforeGeometry}
                />
                <RouteComparisonMap
                  title="After"
                  ariaLabel="최적화 방문 순서 지도"
                  layer="route-optimization-after"
                  color="#2563eb"
                  places={afterPlaces}
                  geometry={afterGeometry}
                />
              </div>
              <RouteDiff before={beforePlaces} after={afterPlaces} />
              <MetricsDiff
                before={beforePlaces}
                beforeTravelMinutes={beforeGeometry.travelMinutes}
                candidate={selectedCandidate}
              />
            </>
          )}

          {error ? (
            <p className="route-optimization-modal-error" role="alert">
              {error}
            </p>
          ) : null}
        </main>
      </div>

      <footer className="route-optimization-modal-actions">
        <span className="route-optimization-progress" aria-live="polite">
          {runState === 'running'
            ? `${progress?.progress ?? 0}% · ${progress?.last_message ?? '실행 중'}`
            : (inputIssue ?? '')}
        </span>
        <Button disabled={applying} onClick={onClose}>
          취소
        </Button>
        <Button
          loading={runState === 'running'}
          disabled={Boolean(inputIssue) || runState === 'running' || applying}
          onClick={() => void runOptimization()}
        >
          {response ? '다시 실행' : '최적화 실행'}
        </Button>
        <Button
          variant="primary"
          loading={applying}
          disabled={!canApply || runState === 'running' || applying}
          onClick={() => void applyCandidate()}
        >
          이 결과 적용
        </Button>
      </footer>
    </Dialog>
  );
}

function AlgorithmList({
  candidates,
  selectedKey,
  running,
  onSelect,
}: {
  candidates: readonly TrouteSolverCandidate[];
  selectedKey: string;
  running: boolean;
  onSelect: (key: string) => void;
}) {
  return (
    <aside className="route-optimization-algorithms" aria-label="알고리즘 선택">
      <h3>알고리즘</h3>
      <div className="route-optimization-algorithm-list">
        {ROUTE_OPTIMIZATION_ALGORITHMS.map((algorithm) => {
          const candidate = getCandidateForAlgorithm(algorithm, candidates);
          const unavailable = !candidate;
          const failed =
            Boolean(candidate?.error) ||
            Boolean(candidate && isTimedOut(candidate));
          return (
            <button
              key={algorithm.key}
              type="button"
              className={`${
                selectedKey === algorithm.key ? 'is-selected' : ''
              } ${failed ? 'is-error' : ''}`.trim()}
              disabled={unavailable}
              aria-pressed={selectedKey === algorithm.key}
              onClick={() => onSelect(algorithm.key)}
            >
              <span className="route-optimization-algorithm-name">
                {algorithm.key === 'best' || candidate?.best ? (
                  <span aria-label="Best Candidate">★</span>
                ) : null}
                {algorithm.label}
              </span>
              <span className="route-optimization-algorithm-meta">
                {candidate
                  ? formatCandidateMeta(candidate)
                  : running
                    ? '실행 중…'
                    : '미실행'}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function CandidateSummary({
  candidate,
}: {
  candidate: TrouteSolverCandidate | null;
}) {
  const score = candidate?.objective_score;
  return (
    <section className="route-optimization-summary">
      <div className="route-optimization-summary-title">
        <span>선택 알고리즘</span>
        <strong>
          {candidate ? getAlgorithmLabel(candidate.strategy) : '결과 없음'}
        </strong>
        {candidate?.best ? <em>★ Best Candidate</em> : null}
      </div>
      <dl>
        <SummaryMetric
          label="Feasible"
          value={candidate ? (candidate.feasible ? 'Yes' : 'No') : '—'}
        />
        <SummaryMetric
          label="Latest Start"
          value={score?.latest_start ?? '—'}
        />
        <SummaryMetric label="Finish" value={score?.finish_time ?? '—'} />
        <SummaryMetric
          label="Travel"
          value={formatMinutes(score?.travel_minutes)}
        />
        <SummaryMetric
          label="Wait"
          value={formatMinutes(score?.wait_minutes)}
        />
        <SummaryMetric
          label="Runtime"
          value={formatRuntime(candidate?.elapsed_ms)}
        />
      </dl>
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function RouteDiff({
  before,
  after,
}: {
  before: readonly TripPlace[];
  after: readonly TripPlace[];
}) {
  const beforeIndex = new Map(
    before.map((place, index) => [place.id, index + 1]),
  );
  const changes = after.flatMap((place, index) => {
    const previous = beforeIndex.get(place.id);
    return previous !== undefined && previous !== index + 1
      ? [{ place, before: previous, after: index + 1 }]
      : [];
  });
  return (
    <section className="route-optimization-diff">
      <h3>Route Diff</h3>
      <div className="route-optimization-order-diff">
        <span>Before</span>
        <p>{before.map((place) => place.name).join(' → ')}</p>
        <span>After</span>
        <p>{after.map((place) => place.name).join(' → ')}</p>
      </div>
      <div className="route-optimization-changes">
        <span>Changed</span>
        {changes.length ? (
          <ul>
            {changes.map((change) => (
              <li key={change.place.id}>
                <strong>{change.place.name}</strong>
                <span>
                  {change.before} → {change.after}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>방문 순서 변경 없음</p>
        )}
      </div>
    </section>
  );
}

function MetricsDiff({
  before,
  beforeTravelMinutes,
  candidate,
}: {
  before: readonly TripPlace[];
  beforeTravelMinutes: number | null;
  candidate: TrouteSolverCandidate;
}) {
  const score = candidate.objective_score;
  const beforeStart = before[0]?.time ?? null;
  const lastPlace = before.at(-1);
  const beforeFinish = lastPlace?.time
    ? addMinutes(
        lastPlace.time,
        lastPlace.visitDurationMinutes ??
          lastPlace.preferredDurationMinutes ??
          0,
      )
    : null;
  const rows = [
    {
      label: 'Travel',
      before: beforeTravelMinutes,
      after: score?.travel_minutes ?? null,
      kind: 'duration' as const,
    },
    {
      label: 'Wait',
      before: null,
      after: score?.wait_minutes ?? null,
      kind: 'duration' as const,
    },
    {
      label: 'Finish',
      before: beforeFinish,
      after: score?.finish_time ?? null,
      kind: 'time' as const,
    },
    {
      label: 'Start',
      before: beforeStart,
      after: score?.latest_start ?? null,
      kind: 'time' as const,
    },
  ];
  return (
    <section className="route-optimization-diff route-optimization-metrics">
      <h3>Metrics Diff</h3>
      <table>
        <thead>
          <tr>
            <th scope="col">Metric</th>
            <th scope="col">Before</th>
            <th scope="col">After</th>
            <th scope="col">Δ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{formatMetric(row.before, row.kind)}</td>
              <td>{formatMetric(row.after, row.kind)}</td>
              <td>{formatDelta(row.before, row.after, row.kind)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function EmptyResult({
  message,
  loading = false,
}: {
  message: string;
  loading?: boolean;
}) {
  return (
    <div
      className="route-optimization-empty"
      role={loading ? 'status' : 'note'}
    >
      <span className={loading ? 'is-loading' : ''} aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

function orderPlaces(
  places: readonly TripPlace[],
  route: readonly string[] | undefined,
): TripPlace[] {
  if (!route) {
    return [...places];
  }
  const placesById = new Map(places.map((place) => [place.id, place]));
  const ordered = route.flatMap((placeId) => {
    const place = placesById.get(placeId);
    return place ? [place] : [];
  });
  return ordered.length === places.length ? ordered : [...places];
}

function formatCandidateMeta(candidate: TrouteSolverCandidate): string {
  if (candidate.error) {
    return '오류';
  }
  if (isTimedOut(candidate)) {
    return '시간 초과';
  }
  const feasible = candidate.feasible ? 'Feasible' : 'Infeasible';
  const score = candidate.objective_score?.travel_minutes;
  return `${feasible}${score === undefined ? '' : ` · ${score}분`} · ${formatRuntime(
    candidate.elapsed_ms,
  )}`;
}

function formatRuntime(value: number | null | undefined): string {
  if (value === undefined || value === null) {
    return '—';
  }
  return value < 1000
    ? `${Math.round(value)}ms`
    : `${(value / 1000).toFixed(2)}s`;
}

function formatMinutes(value: number | null | undefined): string {
  return value === undefined || value === null ? '—' : `${value}분`;
}

function formatMetric(
  value: number | string | null,
  kind: 'duration' | 'time',
): string {
  if (value === null) {
    return '—';
  }
  return kind === 'duration' ? `${value}분` : String(value);
}

function formatDelta(
  before: number | string | null,
  after: number | string | null,
  kind: 'duration' | 'time',
): string {
  if (before === null || after === null) {
    return '—';
  }
  const difference =
    kind === 'duration'
      ? Number(after) - Number(before)
      : clockToMinutes(String(after)) - clockToMinutes(String(before));
  return `${difference > 0 ? '+' : ''}${difference}분`;
}

function addMinutes(time: string, minutes: number): string {
  const total = (clockToMinutes(time) + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(
    total % 60,
  ).padStart(2, '0')}`;
}

function clockToMinutes(value: string): number {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function createDayKey(day: TripDay): string {
  return JSON.stringify({
    id: day.id,
    places: day.places.map((place) => ({
      id: place.id,
      placeId: place.placeId,
      order: place.order,
      time: place.time,
      visitDurationMinutes: place.visitDurationMinutes,
      preferredDurationMinutes: place.preferredDurationMinutes,
      openingHours: place.openingHours,
    })),
  });
}

function cacheResult(key: string, result: TrouteOptimizeResponse): void {
  if (resultCache.size >= 20) {
    resultCache.delete(resultCache.keys().next().value ?? '');
  }
  resultCache.set(key, result);
}
