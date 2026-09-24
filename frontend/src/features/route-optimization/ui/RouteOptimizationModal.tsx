import type {
  TrouteOptimizeResponse,
  TrouteSolverCandidate,
  TrouteTravelMode,
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
  getBestOptimizationCandidate,
  getCurrentDayRoutePath,
  getRouteOptimizationDiagnostics,
  getRouteOptimizationIssue,
  getRouteOptimizationTravelMode,
  isApplicableCandidate,
} from '@/features/route-optimization/model/routeOptimization';
import { useRouteGeometry } from '@/features/route-optimization/model/useRouteGeometry';
import {
  RouteComparisonMap,
  RouteComparisonPlaceholder,
} from '@/features/route-optimization/ui/RouteComparisonMap';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { IconButton } from '@/shared/ui/IconButton';
import { CloseIcon } from '@/shared/ui/icons';

type Props = {
  id: string;
  days: readonly TripDay[];
  initialDayId?: string;
  onClose: () => void;
  onApply: (dayId: string, placeIds: readonly string[]) => Promise<boolean>;
};

type DayOptimizationStatus = 'idle' | 'running' | 'completed' | 'failed';

type DayOptimizationState = {
  status: DayOptimizationStatus;
  progress: RouteOptimizationProgress | null;
  result: TrouteOptimizeResponse | null;
  error: string | null;
};

const resultCache = new Map<string, TrouteOptimizeResponse>();

export function RouteOptimizationModal({
  id,
  days,
  initialDayId,
  onClose,
  onApply,
}: Props) {
  const titleId = useId();
  const descriptionId = useId();
  const validationId = useId();
  const requestAbortControllers = useRef(new Map<string, AbortController>());
  const initialSelectedDay =
    days.find((day) => day.id === initialDayId) ?? days[0]!;
  const [selectedDayId, setSelectedDayId] = useState(initialSelectedDay.id);
  const [dayStates, setDayStates] = useState<
    Record<string, DayOptimizationState>
  >(() => createInitialDayStates(days));
  const [applying, setApplying] = useState(false);
  const selectedDay =
    days.find((day) => day.id === selectedDayId) ?? initialSelectedDay;
  const selectedState = dayStates[selectedDay.id] ?? createIdleDayState();
  const candidate = selectedState.result
    ? getBestOptimizationCandidate(selectedState.result)
    : null;
  const inputIssue = getRouteOptimizationIssue(selectedDay);
  const diagnostics = getRouteOptimizationDiagnostics(selectedDay);
  const travelMode = getRouteOptimizationTravelMode(selectedDay);
  const beforePlaces = useMemo(
    () =>
      [...selectedDay.places].sort((left, right) => left.order - right.order),
    [selectedDay.places],
  );
  const afterPlaces = useMemo(
    () => (candidate ? orderPlaces(beforePlaces, candidate.route) : []),
    [beforePlaces, candidate],
  );
  const storedBeforePath = useMemo(
    () => getCurrentDayRoutePath(selectedDay, travelMode),
    [selectedDay, travelMode],
  );
  const beforeGeometry = useRouteGeometry(
    beforePlaces,
    travelMode,
    storedBeforePath,
  );
  const afterGeometry = useRouteGeometry(afterPlaces, travelMode);
  const canApply = isApplicableCandidate(candidate, selectedDay);

  const runOptimization = useCallback(
    async (day: TripDay, travelMode: TrouteTravelMode) => {
      const current = dayStates[day.id] ?? createIdleDayState();
      const issue = getRouteOptimizationIssue(day);
      if (
        issue ||
        current.status === 'running' ||
        requestAbortControllers.current.has(day.id)
      ) {
        return;
      }
      const controller = new AbortController();
      requestAbortControllers.current.set(day.id, controller);
      setDayStates((states) => ({
        ...states,
        [day.id]: {
          ...states[day.id],
          status: 'running',
          progress: {
            status: 'pending',
            stage: 'accepted',
            progress: 0,
            last_message: '최적화 요청을 전송하고 있습니다.',
          },
          error: null,
          result: states[day.id]?.result ?? null,
        },
      }));
      try {
        const result = await optimizeDayRoute(
          createRouteOptimizationRequest(day, travelMode),
          (progress) => {
            setDayStates((states) => ({
              ...states,
              [day.id]: {
                ...(states[day.id] ?? createIdleDayState()),
                status: 'running',
                progress,
                error: null,
              },
            }));
          },
          controller.signal,
        );
        if (controller.signal.aborted) {
          return;
        }
        cacheResult(createDayKey(day), result);
        setDayStates((states) => ({
          ...states,
          [day.id]: {
            status: 'completed',
            progress: null,
            result,
            error: null,
          },
        }));
      } catch (cause: unknown) {
        if (controller.signal.aborted) {
          return;
        }
        setDayStates((states) => ({
          ...states,
          [day.id]: {
            ...(states[day.id] ?? createIdleDayState()),
            status: 'failed',
            progress: null,
            error:
              cause instanceof Error
                ? cause.message
                : '경로 최적화 요청에 실패했습니다.',
          },
        }));
      } finally {
        if (requestAbortControllers.current.get(day.id) === controller) {
          requestAbortControllers.current.delete(day.id);
        }
      }
    },
    [dayStates],
  );

  useEffect(
    () => () => {
      for (const controller of requestAbortControllers.current.values()) {
        controller.abort();
      }
      requestAbortControllers.current.clear();
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
    try {
      const applied = await onApply(selectedDay.id, candidate.route);
      if (!applied) {
        setDayError(selectedDay.id, '최적화 결과를 Day에 적용하지 못했습니다.');
        return;
      }
      onClose();
    } catch {
      setDayError(selectedDay.id, '최적화 결과를 Day에 적용하지 못했습니다.');
    } finally {
      setApplying(false);
    }
  };

  const setDayError = (dayId: string, error: string) => {
    setDayStates((states) => ({
      ...states,
      [dayId]: {
        ...(states[dayId] ?? createIdleDayState()),
        error,
      },
    }));
  };

  return (
    <Dialog
      id={id}
      className="route-optimization-modal"
      backdropClassName="route-optimization-modal-backdrop"
      labelledBy={titleId}
      describedBy={descriptionId}
      busy={selectedState.status === 'running' || applying}
      closeOnBackdrop={!applying}
      closeOnEscape={!applying}
      onClose={onClose}
    >
      <header className="route-optimization-modal-header">
        <div>
          <h2 id={titleId}>경로 최적화</h2>
          <p id={descriptionId}>Day별 현재 경로와 최적화 경로를 비교합니다.</p>
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
        <DayList
          days={days}
          dayStates={dayStates}
          selectedDayId={selectedDay.id}
          onSelect={setSelectedDayId}
        />

        <main className="route-optimization-result">
          <div className="route-optimization-day-title">
            <div>
              <span>선택 Day</span>
              <h3>{selectedDay.title} 경로 최적화</h3>
            </div>
            <DayStatus state={selectedState} inputIssue={inputIssue} />
          </div>

          {inputIssue ? (
            <OptimizationValidationPanel id={validationId} issue={inputIssue} />
          ) : null}

          <div className="route-optimization-map-grid">
            <RouteComparisonMap
              title="Before"
              ariaLabel={`${selectedDay.title} 현재 방문 순서 지도`}
              layer={`route-optimization-before-${selectedDay.id}`}
              color="#64748b"
              places={beforePlaces}
              geometry={beforeGeometry}
            />
            {candidate ? (
              <RouteComparisonMap
                title="After"
                ariaLabel={`${selectedDay.title} 최적화 방문 순서 지도`}
                layer={`route-optimization-after-${selectedDay.id}`}
                color="#2563eb"
                places={afterPlaces}
                geometry={afterGeometry}
              />
            ) : (
              <RouteComparisonPlaceholder
                title="After"
                message={
                  selectedState.status === 'running'
                    ? '최적화 결과를 기다리고 있습니다.'
                    : '아직 최적화를 실행하지 않았습니다.'
                }
              />
            )}
          </div>

          <MetricsDiff
            before={beforePlaces}
            beforeTravelMinutes={beforeGeometry.travelMinutes}
            candidate={candidate}
          />
          <RouteDiff before={beforePlaces} after={afterPlaces} />

          {diagnostics.openingHoursFallback ? (
            <p className="route-optimization-modal-notice" role="status">
              영업시간 정보 없음:{' '}
              {diagnostics.openingHoursFallbackPlaceNames.join(', ')}. 최적화
              요청에는 00:00~23:50 임시 범위를 사용합니다.
            </p>
          ) : null}
          {selectedState.error ? (
            <p className="route-optimization-modal-error" role="alert">
              {selectedState.error}
              {selectedState.result
                ? ' 기존 성공 결과는 그대로 유지됩니다.'
                : ''}
            </p>
          ) : null}
        </main>
      </div>

      <footer className="route-optimization-modal-actions">
        <span
          className={`route-optimization-progress${inputIssue ? ' is-blocked' : ''}`}
          title={inputIssue ?? undefined}
          aria-live="polite"
        >
          {selectedState.status === 'running'
            ? `${selectedState.progress?.progress ?? 0}% · ${formatProgressMessage(
                selectedState.progress,
              )}`
            : inputIssue
              ? `실행 불가 · ${inputIssue}`
              : ''}
        </span>
        <Button disabled={applying} onClick={onClose}>
          취소
        </Button>
        <Button
          loading={selectedState.status === 'running'}
          disabled={
            Boolean(inputIssue) ||
            selectedState.status === 'running' ||
            applying
          }
          aria-describedby={inputIssue ? validationId : undefined}
          title={inputIssue ?? undefined}
          onClick={() => void runOptimization(selectedDay, travelMode)}
        >
          {selectedState.result ? '다시 실행' : '최적화 실행'}
        </Button>
        <Button
          variant="primary"
          loading={applying}
          disabled={!canApply || selectedState.status === 'running' || applying}
          onClick={() => void applyCandidate()}
        >
          이 결과 적용
        </Button>
      </footer>
    </Dialog>
  );
}

function DayList({
  days,
  dayStates,
  selectedDayId,
  onSelect,
}: {
  days: readonly TripDay[];
  dayStates: Readonly<Record<string, DayOptimizationState>>;
  selectedDayId: string;
  onSelect: (dayId: string) => void;
}) {
  return (
    <aside className="route-optimization-days" aria-label="Day 선택">
      <h3>Day 선택</h3>
      <div className="route-optimization-day-list">
        {days.map((day) => {
          const state = dayStates[day.id] ?? createIdleDayState();
          const inputIssue = getRouteOptimizationIssue(day);
          return (
            <button
              key={day.id}
              type="button"
              className={`${selectedDayId === day.id ? 'is-selected' : ''} is-${state.status}${inputIssue ? ' has-input-issue' : ''}`}
              aria-pressed={selectedDayId === day.id}
              title={inputIssue ?? undefined}
              onClick={() => onSelect(day.id)}
            >
              <span className="route-optimization-day-name">
                <strong>{day.title}</strong>
                <span>{day.places.length}곳</span>
              </span>
              <span className="route-optimization-day-status">
                {inputIssue ? '입력 확인 필요' : formatDayStatus(state)}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function DayStatus({
  state,
  inputIssue,
}: {
  state: DayOptimizationState;
  inputIssue: string | null;
}) {
  return (
    <span
      className={`route-optimization-status ${inputIssue ? 'is-blocked' : `is-${state.status}`}`}
    >
      {inputIssue ? '입력 확인 필요' : formatDayStatus(state)}
    </span>
  );
}

function OptimizationValidationPanel({
  id,
  issue,
}: {
  id: string;
  issue: string;
}) {
  return (
    <section id={id} className="route-optimization-validation" role="alert">
      <span className="route-optimization-validation-icon" aria-hidden="true">
        !
      </span>
      <div>
        <strong>최적화를 실행할 수 없습니다</strong>
        <p>{issue}</p>
        <span>{getValidationResolution(issue)}</span>
      </div>
    </section>
  );
}

function getValidationResolution(issue: string): string {
  if (issue.includes('Place ID')) {
    return '장소 검색에서 표시된 장소를 다시 선택해 Google Place ID를 저장해 주세요.';
  }
  if (issue.includes('2개 이상의 장소')) {
    return '이 Day에 출발 장소와 도착 장소를 포함해 장소를 2개 이상 추가해 주세요.';
  }
  if (issue.includes('HH:mm')) {
    return '최소 출발 가능 시각을 09:00과 같은 형식으로 입력해 주세요.';
  }
  if (issue.includes('이동수단')) {
    return 'Day의 이동수단을 대중교통, 자동차, 도보 또는 자전거로 설정해 주세요.';
  }
  return '장소의 영업시간과 체류시간 입력을 확인한 뒤 다시 시도해 주세요.';
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
  const changes = after.filter(
    (place, index) => beforeIndex.get(place.id) !== index + 1,
  );
  return (
    <section className="route-optimization-diff">
      <h3>방문 순서</h3>
      <div className="route-optimization-order-diff">
        <span>기존</span>
        <p>{formatOrder(before)}</p>
        <span>변경</span>
        <p className="route-optimization-after-order">
          {after.length
            ? after.map((place, index) => (
                <span
                  key={place.id}
                  className={changes.includes(place) ? 'is-changed' : ''}
                >
                  {index > 0 ? ' → ' : ''}
                  {place.name}
                </span>
              ))
            : '—'}
        </p>
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
  candidate: TrouteSolverCandidate | null;
}) {
  const score = candidate?.objective_score;
  const beforeStart = before[0]?.time ?? null;
  const lastPlace = before.at(-1);
  const beforeFinish = lastPlace?.time
    ? addMinutes(lastPlace.time, getStayMinutes(lastPlace))
    : null;
  const beforeWait = calculateBeforeWait(
    before,
    beforeStart,
    beforeFinish,
    beforeTravelMinutes,
  );
  const rows = [
    {
      label: '이동시간',
      before: beforeTravelMinutes,
      after: score?.travel_minutes ?? null,
      kind: 'duration' as const,
    },
    {
      label: '대기시간',
      before: beforeWait,
      after: score?.wait_minutes ?? null,
      kind: 'duration' as const,
    },
    {
      label: '종료시각',
      before: beforeFinish,
      after: score?.finish_time ?? null,
      kind: 'time' as const,
    },
    {
      label: '출발시각',
      before: beforeStart,
      after: score?.latest_start ?? null,
      kind: 'time' as const,
    },
  ];
  return (
    <section className="route-optimization-diff route-optimization-metrics">
      <h3>경로 비교</h3>
      <table>
        <thead>
          <tr>
            <th scope="col">항목</th>
            <th scope="col">Before</th>
            <th scope="col">After</th>
            <th scope="col">Diff</th>
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

function orderPlaces(
  places: readonly TripPlace[],
  route: readonly string[],
): TripPlace[] {
  const placesById = new Map(places.map((place) => [place.id, place]));
  const ordered = route.flatMap((placeId) => {
    const place = placesById.get(placeId);
    return place ? [place] : [];
  });
  return ordered.length === places.length ? ordered : [...places];
}

function formatDayStatus(state: DayOptimizationState): string {
  if (state.status === 'running') {
    return `${state.progress?.progress ?? 0}% 실행 중`;
  }
  if (state.status === 'failed') {
    return state.result ? '결과 유지 · 재실행 실패' : '실패';
  }
  if (state.result) {
    return '최적화 완료';
  }
  return '실행 전';
}

function formatProgressMessage(
  progress: RouteOptimizationProgress | null,
): string {
  switch (progress?.stage) {
    case 'accepted':
      return '최적화 요청 대기 중';
    case 'building_matrix':
      return '이동시간 계산 중';
    case 'solving':
      return '경로 최적화 중';
    case 'scheduling':
      return '일정 생성 중';
    default:
      return progress?.last_message ?? '최적화 실행 중';
  }
}

function formatOrder(places: readonly TripPlace[]): string {
  return places.length ? places.map((place) => place.name).join(' → ') : '—';
}

function getStayMinutes(place: TripPlace): number {
  return place.visitDurationMinutes ?? place.preferredDurationMinutes ?? 0;
}

function calculateBeforeWait(
  places: readonly TripPlace[],
  start: string | null,
  finish: string | null,
  travelMinutes: number | null,
): number | null {
  if (!start || !finish || travelMinutes === null) {
    return null;
  }
  const elapsed = clockToMinutes(finish) - clockToMinutes(start);
  const stayMinutes = places.reduce(
    (total, place) => total + getStayMinutes(place),
    0,
  );
  return Math.max(0, elapsed - travelMinutes - stayMinutes);
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

function createIdleDayState(): DayOptimizationState {
  return { status: 'idle', progress: null, result: null, error: null };
}

function createInitialDayStates(
  days: readonly TripDay[],
): Record<string, DayOptimizationState> {
  return Object.fromEntries(
    days.map((day) => {
      const result = resultCache.get(createDayKey(day)) ?? null;
      return [
        day.id,
        result
          ? { status: 'completed', progress: null, result, error: null }
          : createIdleDayState(),
      ];
    }),
  );
}

function createDayKey(day: TripDay): string {
  return JSON.stringify({
    id: day.id,
    travelMode: getRouteOptimizationTravelMode(day),
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
  if (resultCache.size >= 40) {
    resultCache.delete(resultCache.keys().next().value ?? '');
  }
  resultCache.set(key, result);
}
