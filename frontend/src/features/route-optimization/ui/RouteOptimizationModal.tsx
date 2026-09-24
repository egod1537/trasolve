import type {
  TrouteOptimizeResponse,
  TrouteSolverCandidate,
  TrouteTravelMode,
  TripDay,
  TripPlace,
  TripScheduleUpdate,
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
  createRouteOptimizationSchedule,
  createTripScheduleUpdate,
  getBestOptimizationCandidate,
  getCurrentDayRoutePath,
  getRouteOptimizationDiagnostics,
  getRouteOptimizationIssue,
  getRouteOptimizationTravelMode,
  isApplicableCandidate,
  orderRouteOptimizationPlaces,
  type RouteOptimizationSchedule,
  type RouteOptimizationRequestOptions,
  type RouteOptimizationStartPolicy,
} from '@/features/route-optimization/model/routeOptimization';
import { useRouteGeometry } from '@/features/route-optimization/model/useRouteGeometry';
import {
  RouteComparisonMap,
  RouteComparisonPlaceholder,
} from '@/features/route-optimization/ui/RouteComparisonMap';
import { RouteSchedulePreview } from '@/features/route-optimization/ui/RouteSchedulePreview';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { IconButton } from '@/shared/ui/IconButton';
import { CloseIcon } from '@/shared/ui/icons';

type Props = {
  id: string;
  days: readonly TripDay[];
  initialDayId?: string;
  onClose: () => void;
  onApply: (dayId: string, schedule: TripScheduleUpdate) => Promise<boolean>;
};

type DayOptimizationStatus = 'idle' | 'running' | 'completed' | 'failed';

type DayOptimizationState = {
  status: DayOptimizationStatus;
  progress: RouteOptimizationProgress | null;
  result: TrouteOptimizeResponse | null;
  error: string | null;
};

type DayOptimizationSettings = RouteOptimizationRequestOptions;

const TRAVEL_MODE_OPTIONS: readonly {
  value: TrouteTravelMode;
  label: string;
}[] = [
  { value: 'TRANSIT', label: '대중교통' },
  { value: 'DRIVING', label: '자동차' },
  { value: 'WALKING', label: '도보' },
  { value: 'BICYCLING', label: '자전거' },
];

const START_POLICY_OPTIONS: readonly {
  value: RouteOptimizationStartPolicy;
  label: string;
}[] = [
  { value: 'fixed', label: '지정 시각' },
  { value: 'earliest', label: '최대한 이르게' },
  { value: 'latest', label: '최대한 늦게' },
];

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
  const [daySettings, setDaySettings] = useState<
    Record<string, DayOptimizationSettings>
  >(() => createInitialDaySettings(days));
  const [dayStates, setDayStates] = useState<
    Record<string, DayOptimizationState>
  >(() => createInitialDayStates(days));
  const [applying, setApplying] = useState(false);
  const selectedDay =
    days.find((day) => day.id === selectedDayId) ?? initialSelectedDay;
  const selectedSettings =
    daySettings[selectedDay.id] ?? createDayOptimizationSettings(selectedDay);
  const selectedState = dayStates[selectedDay.id] ?? createIdleDayState();
  const candidate = selectedState.result
    ? getBestOptimizationCandidate(selectedState.result)
    : null;
  const displayCandidate =
    selectedState.status === 'running' ? null : candidate;
  const inputIssue = getRouteOptimizationIssue(selectedDay, selectedSettings);
  const diagnostics = getRouteOptimizationDiagnostics(selectedDay);
  const travelMode = selectedSettings.travelMode;
  const originalBeforePlaces = useMemo(
    () =>
      [...selectedDay.places].sort((left, right) => left.order - right.order),
    [selectedDay.places],
  );
  const beforePlaces = useMemo(
    () => orderRouteOptimizationPlaces(selectedDay, selectedSettings),
    [selectedDay, selectedSettings],
  );
  const afterPlaces = useMemo(
    () =>
      displayCandidate ? orderPlaces(beforePlaces, displayCandidate.route) : [],
    [beforePlaces, displayCandidate],
  );
  const optimizedSchedule = useMemo(
    () =>
      selectedState.result && displayCandidate
        ? createRouteOptimizationSchedule(
            selectedState.result,
            displayCandidate,
            selectedDay,
          )
        : null,
    [displayCandidate, selectedDay, selectedState.result],
  );
  const storedBeforePath = useMemo(
    () =>
      hasCurrentDayOrder(selectedDay, beforePlaces)
        ? getCurrentDayRoutePath(selectedDay, travelMode)
        : undefined,
    [beforePlaces, selectedDay, travelMode],
  );
  const beforeGeometry = useRouteGeometry(
    beforePlaces,
    travelMode,
    storedBeforePath,
  );
  const afterGeometry = useRouteGeometry(afterPlaces, travelMode);
  const canApply =
    optimizedSchedule !== null &&
    isApplicableCandidate(candidate, selectedDay, selectedSettings);

  const updateSelectedSettings = (patch: Partial<DayOptimizationSettings>) => {
    if (selectedState.status === 'running' || applying) {
      return;
    }
    const nextSettings = { ...selectedSettings, ...patch };
    const cachedResult = resultCache.get(
      createDayKey(selectedDay, nextSettings),
    );
    setDaySettings((settings) => ({
      ...settings,
      [selectedDay.id]: nextSettings,
    }));
    setDayStates((states) => ({
      ...states,
      [selectedDay.id]: cachedResult
        ? {
            status: 'completed',
            progress: null,
            result: cachedResult,
            error: null,
          }
        : createIdleDayState(),
    }));
  };

  const runOptimization = useCallback(
    async (day: TripDay, settings: DayOptimizationSettings) => {
      const current = dayStates[day.id] ?? createIdleDayState();
      const issue = getRouteOptimizationIssue(day, settings);
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
          createRouteOptimizationRequest(day, settings),
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
        cacheResult(createDayKey(day, settings), result);
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
    if (!canApply || !candidate || !optimizedSchedule || applying) {
      return;
    }
    setApplying(true);
    try {
      const applied = await onApply(
        selectedDay.id,
        createTripScheduleUpdate(
          optimizedSchedule,
          selectedSettings.selectedStartPlaceId,
          selectedSettings.selectedEndPlaceId,
        ),
      );
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
          daySettings={daySettings}
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

          <OptimizationSettings
            day={selectedDay}
            settings={selectedSettings}
            disabled={selectedState.status === 'running' || applying}
            onChange={updateSelectedSettings}
          />

          {inputIssue ? (
            <OptimizationValidationPanel id={validationId} issue={inputIssue} />
          ) : null}

          <section className="route-optimization-map-section">
            <div className="route-optimization-section-heading">
              <div>
                <h3>경로 비교</h3>
                <p>현재 방문 순서와 최적화된 방문 순서를 비교합니다.</p>
              </div>
              <span>
                {
                  TRAVEL_MODE_OPTIONS.find(
                    (option) => option.value === travelMode,
                  )?.label
                }
              </span>
            </div>
            <div className="route-optimization-map-grid">
              <RouteComparisonMap
                title="Before"
                ariaLabel={`${selectedDay.title} 현재 방문 순서 지도`}
                layer={`route-optimization-before-${selectedDay.id}-${travelMode}`}
                color="#64748b"
                places={beforePlaces}
                geometry={beforeGeometry}
              />
              {displayCandidate ? (
                <RouteComparisonMap
                  title="After"
                  ariaLabel={`${selectedDay.title} 최적화 방문 순서 지도`}
                  layer={`route-optimization-after-${selectedDay.id}-${travelMode}`}
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
          </section>

          <RouteSchedulePreview
            beforePlaces={beforePlaces}
            afterPlaces={afterPlaces}
            schedule={optimizedSchedule}
            running={selectedState.status === 'running'}
            hasResult={displayCandidate !== null}
          />

          <div className="route-optimization-result-grid">
            <MetricsDiff
              before={beforePlaces}
              beforeTravelMinutes={beforeGeometry.travelMinutes}
              candidate={displayCandidate}
              schedule={optimizedSchedule}
              startPolicy={selectedSettings.startPolicy}
              requestedStartTime={selectedSettings.startTime}
              running={selectedState.status === 'running'}
            />
            <div className="route-optimization-result-details">
              <RouteDiff
                before={beforePlaces}
                after={afterPlaces}
                running={selectedState.status === 'running'}
              />
              <ChangeSummary
                originalBefore={originalBeforePlaces}
                before={beforePlaces}
                after={afterPlaces}
                beforeTravelMinutes={beforeGeometry.travelMinutes}
                candidate={displayCandidate}
                schedule={optimizedSchedule}
                running={selectedState.status === 'running'}
              />
            </div>
          </div>

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
          onClick={() => void runOptimization(selectedDay, selectedSettings)}
        >
          {selectedState.result ? '다시 실행' : '최적화 실행'}
        </Button>
        <Button
          variant="primary"
          loading={applying}
          disabled={!canApply || selectedState.status === 'running' || applying}
          title={
            candidate && !optimizedSchedule
              ? '최적화 결과의 일정 정보를 확인할 수 없어 적용할 수 없습니다.'
              : undefined
          }
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
  daySettings,
  selectedDayId,
  onSelect,
}: {
  days: readonly TripDay[];
  dayStates: Readonly<Record<string, DayOptimizationState>>;
  daySettings: Readonly<Record<string, DayOptimizationSettings>>;
  selectedDayId: string;
  onSelect: (dayId: string) => void;
}) {
  return (
    <aside className="route-optimization-days" aria-label="Day 선택">
      <h3>Day 선택</h3>
      <div className="route-optimization-day-list">
        {days.map((day) => {
          const state = dayStates[day.id] ?? createIdleDayState();
          const settings =
            daySettings[day.id] ?? createDayOptimizationSettings(day);
          const inputIssue = getRouteOptimizationIssue(day, settings);
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

function OptimizationSettings({
  day,
  settings,
  disabled,
  onChange,
}: {
  day: TripDay;
  settings: DayOptimizationSettings;
  disabled: boolean;
  onChange: (patch: Partial<DayOptimizationSettings>) => void;
}) {
  const orderedPlaces = [...day.places].sort(
    (left, right) => left.order - right.order,
  );
  const start = orderedPlaces[0];
  const selectedStart = orderedPlaces.find(
    (place) => place.id === settings.selectedStartPlaceId,
  );
  const changeStartPlace = (placeId: string) => {
    onChange(
      placeId === settings.selectedEndPlaceId
        ? {
            selectedStartPlaceId: placeId,
            selectedEndPlaceId: settings.selectedStartPlaceId,
          }
        : { selectedStartPlaceId: placeId },
    );
  };
  const changeEndPlace = (placeId: string) => {
    onChange(
      placeId === settings.selectedStartPlaceId
        ? {
            selectedStartPlaceId: settings.selectedEndPlaceId,
            selectedEndPlaceId: placeId,
          }
        : { selectedEndPlaceId: placeId },
    );
  };
  const changeStartPolicy = (startPolicy: RouteOptimizationStartPolicy) => {
    onChange({
      startPolicy,
      startTime:
        startPolicy === 'fixed'
          ? (settings.startTime ??
            selectedStart?.time ??
            start?.time ??
            '09:00')
          : null,
    });
  };

  return (
    <section className="route-optimization-settings">
      <div className="route-optimization-section-heading">
        <div>
          <h3>최적화 설정</h3>
          <p>선택 Day의 시작·종점과 출발 조건을 설정합니다.</p>
        </div>
      </div>
      <div className="route-optimization-settings-grid">
        <label className="route-optimization-setting-card">
          <span>시작점</span>
          <select
            value={settings.selectedStartPlaceId}
            disabled={disabled || orderedPlaces.length < 2}
            aria-label="경로 최적화 시작점"
            onChange={(event) => changeStartPlace(event.target.value)}
          >
            {orderedPlaces.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </select>
          <small>선택한 장소를 경로의 첫 장소로 사용</small>
        </label>
        <label className="route-optimization-setting-card">
          <span>도착점</span>
          <select
            value={settings.selectedEndPlaceId}
            disabled={disabled || orderedPlaces.length < 2}
            aria-label="경로 최적화 종점"
            onChange={(event) => changeEndPlace(event.target.value)}
          >
            {orderedPlaces.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </select>
          <small>선택한 장소를 경로의 마지막 장소로 사용</small>
        </label>
        <fieldset className="route-optimization-setting-card route-optimization-start-policy">
          <legend>시작 방식</legend>
          <div className="route-optimization-policy-options">
            {START_POLICY_OPTIONS.map((option) => (
              <label key={option.value}>
                <input
                  type="radio"
                  name={`route-optimization-start-policy-${day.id}`}
                  value={option.value}
                  checked={settings.startPolicy === option.value}
                  disabled={disabled}
                  onChange={() => changeStartPolicy(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          <span className="route-optimization-time-field">
            <span>시작 시각</span>
            <input
              type="time"
              step={600}
              value={settings.startTime ?? ''}
              disabled={disabled || settings.startPolicy !== 'fixed'}
              aria-label="고정 시작 시각"
              onChange={(event) =>
                onChange({ startTime: event.target.value || null })
              }
            />
          </span>
        </fieldset>
        <label className="route-optimization-setting-card">
          <span>이동수단</span>
          <select
            value={settings.travelMode}
            disabled={disabled}
            aria-label="경로 최적화 이동수단"
            onChange={(event) =>
              onChange({ travelMode: event.target.value as TrouteTravelMode })
            }
          >
            {TRAVEL_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <small>최적화 요청과 지도 경로에 동일 적용</small>
        </label>
      </div>
      <p className="route-optimization-settings-note">
        시작 방식에 따라 지정 시각에 출발하거나, 가능한 가장 이른·늦은
        출발시각을 탐색합니다.
      </p>
    </section>
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
  if (issue.includes('시작점') || issue.includes('종점')) {
    return '현재 Day의 서로 다른 장소를 시작점과 종점으로 선택해 주세요.';
  }
  if (issue.includes('지정 시작 시각') || issue.includes('지정 시각 시작')) {
    return '시작 시각을 09:00과 같은 형식의 10분 단위로 입력해 주세요.';
  }
  if (issue.includes('Place ID')) {
    return '장소 검색에서 표시된 장소를 다시 선택해 Google Place ID를 저장해 주세요.';
  }
  if (issue.includes('2개 이상의 장소')) {
    return '이 Day에 출발 장소와 도착 장소를 포함해 장소를 2개 이상 추가해 주세요.';
  }
  if (issue.includes('이동수단')) {
    return 'Day의 이동수단을 대중교통, 자동차, 도보 또는 자전거로 설정해 주세요.';
  }
  return '장소의 영업시간과 체류시간 입력을 확인한 뒤 다시 시도해 주세요.';
}

function RouteDiff({
  before,
  after,
  running,
}: {
  before: readonly TripPlace[];
  after: readonly TripPlace[];
  running: boolean;
}) {
  const beforeIndex = new Map(
    before.map((place, index) => [place.id, index + 1]),
  );
  const afterIndex = new Map(
    after.map((place, index) => [place.id, index + 1]),
  );
  const changes = after.filter(
    (place, index) => beforeIndex.get(place.id) !== index + 1,
  );
  return (
    <section className="route-optimization-diff">
      <h3>방문 순서</h3>
      <div className="route-optimization-order-diff">
        <span>Before</span>
        <p>{formatOrder(before)}</p>
        {after.length ? (
          <>
            <span>After</span>
            <p className="route-optimization-after-order">
              {after.map((place, index) => (
                <span
                  key={place.id}
                  className={changes.includes(place) ? 'is-changed' : ''}
                >
                  {index > 0 ? ' → ' : ''}
                  {place.name}
                </span>
              ))}
            </p>
          </>
        ) : null}
      </div>
      {after.length ? (
        changes.length ? (
          <div className="route-optimization-position-changes">
            <span>변경 위치</span>
            <ul>
              {changes.map((place) => (
                <li key={place.id}>
                  <strong>{place.name}</strong>
                  <span>
                    {beforeIndex.get(place.id)} → {afterIndex.get(place.id)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="route-optimization-diff-message">
            방문 순서 변경이 없습니다.
          </p>
        )
      ) : (
        <DiffPendingMessage
          running={running}
          idleMessage="최적화 후 변경된 방문 위치를 확인할 수 있습니다."
          runningMessage="방문 순서 차이를 계산하고 있습니다."
        />
      )}
    </section>
  );
}

function ChangeSummary({
  originalBefore,
  before,
  after,
  beforeTravelMinutes,
  candidate,
  schedule,
  running,
}: {
  originalBefore: readonly TripPlace[];
  before: readonly TripPlace[];
  after: readonly TripPlace[];
  beforeTravelMinutes: number | null;
  candidate: TrouteSolverCandidate | null;
  schedule: RouteOptimizationSchedule | null;
  running: boolean;
}) {
  const sentences = createChangeSummarySentences(
    originalBefore,
    before,
    after,
    beforeTravelMinutes,
    candidate,
    schedule,
  );

  return (
    <section className="route-optimization-diff route-optimization-summary">
      <h3>변경 요약</h3>
      {after.length === 0 ? (
        <DiffPendingMessage
          running={running}
          idleMessage="최적화 후 주요 변경 사항을 문장으로 확인할 수 있습니다."
          runningMessage="변경 요약을 작성하고 있습니다."
        />
      ) : sentences.length === 0 ? (
        <p className="route-optimization-diff-message">
          경로 및 주요 지표 변경이 없습니다.
        </p>
      ) : (
        <ul className="route-optimization-summary-list">
          {sentences.map((sentence) => (
            <li key={sentence}>{sentence}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DiffPendingMessage({
  running,
  idleMessage,
  runningMessage,
}: {
  running: boolean;
  idleMessage: string;
  runningMessage: string;
}) {
  return (
    <p
      className={`route-optimization-diff-message${running ? ' is-running' : ''}`}
      role="status"
    >
      {running ? runningMessage : idleMessage}
    </p>
  );
}

function createChangeSummarySentences(
  originalBefore: readonly TripPlace[],
  before: readonly TripPlace[],
  after: readonly TripPlace[],
  beforeTravelMinutes: number | null,
  candidate: TrouteSolverCandidate | null,
  schedule: RouteOptimizationSchedule | null,
): string[] {
  if (!candidate || after.length === 0) {
    return [];
  }
  const sentences: string[] = [];
  const beforeIndex = new Map(
    before.map((place, index) => [place.id, index + 1]),
  );
  const moved = after.flatMap((place, index) => {
    const previous = beforeIndex.get(place.id);
    const next = index + 1;
    return previous !== undefined && previous !== next
      ? [{ place, previous, next }]
      : [];
  });
  for (const { place, previous, next } of moved.slice(0, 4)) {
    sentences.push(
      `${withSubjectParticle(place.name)} ${previous}번째 → ${next}번째로 이동했습니다.`,
    );
  }
  if (moved.length > 4) {
    sentences.push(`그 외 ${moved.length - 4}개 장소의 순서가 변경되었습니다.`);
  }

  const configuredStart = before[0];
  const configuredEnd = before.at(-1);
  if (configuredStart && configuredStart.id !== originalBefore[0]?.id) {
    sentences.push(
      `${withSubjectParticle(configuredStart.name)} 시작점으로 설정되었습니다.`,
    );
  }
  if (configuredEnd && configuredEnd.id !== originalBefore.at(-1)?.id) {
    sentences.push(
      `${withSubjectParticle(configuredEnd.name)} 종점으로 설정되었습니다.`,
    );
  }

  appendDurationSummary(
    sentences,
    '전체 이동시간',
    beforeTravelMinutes,
    getScheduleTravelMinutes(schedule) ??
      candidate.objective_score?.travel_minutes ??
      null,
  );
  const beforeStart = before[0]?.time ?? null;
  const lastPlace = before.at(-1);
  const beforeFinish = lastPlace?.time
    ? addMinutes(lastPlace.time, getStayMinutes(lastPlace))
    : null;
  appendDurationSummary(
    sentences,
    '대기시간',
    calculateBeforeWait(before, beforeStart, beforeFinish, beforeTravelMinutes),
    schedule
      ? schedule.stops.reduce((total, stop) => total + stop.waitMinutes, 0)
      : (candidate.objective_score?.wait_minutes ?? null),
  );
  return sentences;
}

function appendDurationSummary(
  sentences: string[],
  label: string,
  before: number | null,
  after: number | null,
): void {
  if (before === null || after === null || before === after) {
    return;
  }
  const difference = after - before;
  sentences.push(
    `${label}${hasFinalConsonant(label) ? '이' : '가'} ${Math.abs(difference)}분 ${difference < 0 ? '감소' : '증가'}했습니다.`,
  );
}

function withSubjectParticle(value: string): string {
  return `${value}${hasFinalConsonant(value) ? '이' : '가'}`;
}

function hasFinalConsonant(value: string): boolean {
  const codePoint = value.codePointAt(value.length - 1);
  return (
    codePoint !== undefined &&
    codePoint >= 0xac00 &&
    codePoint <= 0xd7a3 &&
    (codePoint - 0xac00) % 28 !== 0
  );
}

function MetricsDiff({
  before,
  beforeTravelMinutes,
  candidate,
  schedule,
  startPolicy,
  requestedStartTime,
  running,
}: {
  before: readonly TripPlace[];
  beforeTravelMinutes: number | null;
  candidate: TrouteSolverCandidate | null;
  schedule: RouteOptimizationSchedule | null;
  startPolicy: RouteOptimizationStartPolicy;
  requestedStartTime: string | null;
  running: boolean;
}) {
  const score = candidate?.objective_score;
  const scheduledStart = schedule?.stops[0]?.departureTime ?? null;
  const scheduledFinish = schedule?.stops.at(-1)?.departureTime ?? null;
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
      after:
        getScheduleTravelMinutes(schedule) ?? score?.travel_minutes ?? null,
      metric: 'travel' as const,
      kind: 'duration' as const,
    },
    {
      label: '대기시간',
      before: beforeWait,
      after: schedule
        ? schedule.stops.reduce((total, stop) => total + stop.waitMinutes, 0)
        : (score?.wait_minutes ?? null),
      metric: 'wait' as const,
      kind: 'duration' as const,
    },
    {
      label: '출발시각',
      before: beforeStart,
      after: scheduledStart ?? score?.latest_start ?? null,
      metric: 'start' as const,
      kind: 'time' as const,
    },
    {
      label: '종료시각',
      before: beforeFinish,
      after: scheduledFinish ?? score?.finish_time ?? null,
      metric: 'finish' as const,
      kind: 'time' as const,
    },
  ];
  return (
    <section className="route-optimization-diff route-optimization-metrics">
      <h3>지표 변화</h3>
      {candidate ? (
        <table>
          <thead>
            <tr>
              <th scope="col">항목</th>
              <th scope="col">Before</th>
              <th scope="col">After</th>
              <th scope="col">변화</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const assessment = assessMetricChange(
                row.metric,
                row.before,
                row.after,
                row.kind,
                startPolicy,
                requestedStartTime,
              );
              return (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{formatMetric(row.before, row.kind)}</td>
                  <td>{formatMetric(row.after, row.kind)}</td>
                  <td
                    className={`route-optimization-metric-change is-${assessment.tone}`}
                  >
                    <span>{formatDelta(row.before, row.after, row.kind)}</span>
                    {assessment.label ? (
                      <small>{assessment.label}</small>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <DiffPendingMessage
          running={running}
          idleMessage="최적화를 실행하면 현재 경로와 결과의 차이를 확인할 수 있습니다."
          runningMessage="경로 지표의 차이를 계산하고 있습니다."
        />
      )}
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

function getScheduleTravelMinutes(
  schedule: RouteOptimizationSchedule | null,
): number | null {
  if (!schedule) {
    return null;
  }
  return schedule.stops.reduce(
    (total, stop) => total + (stop.travelMinutesFromPrevious ?? 0),
    0,
  );
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

function assessMetricChange(
  metric: 'travel' | 'wait' | 'start' | 'finish',
  before: number | string | null,
  after: number | string | null,
  kind: 'duration' | 'time',
  startPolicy: RouteOptimizationStartPolicy,
  requestedStartTime: string | null,
): { tone: 'improvement' | 'warning' | 'neutral'; label: string | null } {
  const difference = calculateMetricDelta(before, after, kind);
  if (difference === null) {
    return { tone: 'neutral', label: null };
  }
  if (metric === 'start' && startPolicy === 'fixed') {
    const matchesRequestedTime =
      typeof after === 'string' && after === requestedStartTime;
    return matchesRequestedTime
      ? { tone: 'neutral', label: '지정 시각 일치' }
      : { tone: 'warning', label: '지정 시각과 다름' };
  }
  if (difference === 0) {
    return { tone: 'neutral', label: '변화 없음' };
  }
  if (metric === 'start') {
    const improved = startPolicy === 'latest' ? difference > 0 : difference < 0;
    return {
      tone: improved ? 'improvement' : 'warning',
      label: difference > 0 ? '더 늦게 출발' : '더 일찍 출발',
    };
  }
  if (difference < 0) {
    return {
      tone: 'improvement',
      label: metric === 'finish' ? '더 일찍 종료' : '감소 · 개선',
    };
  }
  return {
    tone: 'warning',
    label: metric === 'finish' ? '더 늦게 종료' : '증가',
  };
}

function formatDelta(
  before: number | string | null,
  after: number | string | null,
  kind: 'duration' | 'time',
): string {
  const difference = calculateMetricDelta(before, after, kind);
  if (difference === null) {
    return '—';
  }
  return `${difference > 0 ? '+' : ''}${difference}분`;
}

function calculateMetricDelta(
  before: number | string | null,
  after: number | string | null,
  kind: 'duration' | 'time',
): number | null {
  if (before === null || after === null) {
    return null;
  }
  return kind === 'duration'
    ? Number(after) - Number(before)
    : clockToMinutes(String(after)) - clockToMinutes(String(before));
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

function createInitialDaySettings(
  days: readonly TripDay[],
): Record<string, DayOptimizationSettings> {
  return Object.fromEntries(
    days.map((day) => [day.id, createDayOptimizationSettings(day)]),
  );
}

function createDayOptimizationSettings(day: TripDay): DayOptimizationSettings {
  const orderedPlaces = [...day.places].sort(
    (left, right) => left.order - right.order,
  );
  return {
    selectedStartPlaceId: orderedPlaces[0]?.id ?? '',
    selectedEndPlaceId: orderedPlaces.at(-1)?.id ?? '',
    startPolicy: 'latest',
    startTime: null,
    travelMode: getRouteOptimizationTravelMode(day),
  };
}

function hasCurrentDayOrder(
  day: TripDay,
  places: readonly TripPlace[],
): boolean {
  const orderedPlaces = [...day.places].sort(
    (left, right) => left.order - right.order,
  );
  return (
    orderedPlaces.length === places.length &&
    orderedPlaces.every((place, index) => place.id === places[index]?.id)
  );
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

function createDayKey(
  day: TripDay,
  settings: DayOptimizationSettings = createDayOptimizationSettings(day),
): string {
  return JSON.stringify({
    id: day.id,
    selectedStartPlaceId: settings.selectedStartPlaceId,
    selectedEndPlaceId: settings.selectedEndPlaceId,
    startPolicy: settings.startPolicy,
    startTime: settings.startTime,
    travelMode: settings.travelMode,
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
