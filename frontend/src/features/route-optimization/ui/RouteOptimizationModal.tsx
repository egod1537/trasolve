import type {
  TrouteOptimizeResponse,
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
  getOptimizationStayMinutes,
  getRouteOptimizationDiagnostics,
  getRouteOptimizationIssue,
  getRouteOptimizationTravelMode,
  isApplicableCandidate,
  type RouteOptimizationRequestOptions,
  type RouteOptimizationStartPolicy,
} from '@/features/route-optimization/model/routeOptimization';
import { useRouteTravelMinutes } from '@/features/route-optimization/model/useRouteTravelMinutes';
import {
  RouteComparisonMap,
  RouteComparisonPlaceholder,
} from '@/features/route-optimization/ui/RouteComparisonMap';
import { RouteMapComparisonDialog } from '@/features/route-optimization/ui/RouteMapComparisonDialog';
import { RouteOptimizationMetrics } from '@/features/route-optimization/ui/RouteOptimizationMetrics';
import {
  RouteOptimizationProgressDialog,
  type RouteOptimizationProgressPhase,
} from '@/features/route-optimization/ui/RouteOptimizationProgressDialog';
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

type ProgressDialogState = {
  dayId: string;
  phase: RouteOptimizationProgressPhase;
};

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
  const userCancelledDayIds = useRef(new Set<string>());
  const completionCloseTimer = useRef<number | null>(null);
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
  const [mapComparisonOpen, setMapComparisonOpen] = useState(false);
  const [endpointMenuOpen, setEndpointMenuOpen] = useState(false);
  const [progressDialog, setProgressDialog] =
    useState<ProgressDialogState | null>(null);
  const selectedDay =
    days.find((day) => day.id === selectedDayId) ?? initialSelectedDay;
  const selectedSettings =
    daySettings[selectedDay.id] ?? createDayOptimizationSettings(selectedDay);
  const selectedState = dayStates[selectedDay.id] ?? createIdleDayState();
  const progressDayState = progressDialog
    ? (dayStates[progressDialog.dayId] ?? createIdleDayState())
    : null;
  const candidate = selectedState.result
    ? getBestOptimizationCandidate(selectedState.result)
    : null;
  const displayCandidate = candidate;
  const inputIssue = getRouteOptimizationIssue(selectedDay, selectedSettings);
  const diagnostics = getRouteOptimizationDiagnostics(selectedDay);
  const travelMode = selectedSettings.travelMode;
  const beforePlaces = useMemo(
    () =>
      [...selectedDay.places].sort((left, right) => left.order - right.order),
    [selectedDay.places],
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
  const beforeTravelMinutes = useRouteTravelMinutes(beforePlaces, travelMode);
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

  const setStartPlace = (placeId: string) => {
    if (placeId === selectedSettings.selectedStartPlaceId) {
      return;
    }
    updateSelectedSettings(
      placeId === selectedSettings.selectedEndPlaceId
        ? {
            selectedStartPlaceId: placeId,
            selectedEndPlaceId: selectedSettings.selectedStartPlaceId,
          }
        : { selectedStartPlaceId: placeId },
    );
  };

  const setEndPlace = (placeId: string) => {
    if (placeId === selectedSettings.selectedEndPlaceId) {
      return;
    }
    updateSelectedSettings(
      placeId === selectedSettings.selectedStartPlaceId
        ? {
            selectedStartPlaceId: selectedSettings.selectedEndPlaceId,
            selectedEndPlaceId: placeId,
          }
        : { selectedEndPlaceId: placeId },
    );
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
      const runState: { latestProgress: RouteOptimizationProgress | null } = {
        latestProgress: null,
      };
      requestAbortControllers.current.set(day.id, controller);
      setProgressDialog({ dayId: day.id, phase: 'submitting' });
      setDayStates((states) => ({
        ...states,
        [day.id]: {
          ...states[day.id],
          status: 'running',
          progress: null,
          error: null,
          result: states[day.id]?.result ?? null,
        },
      }));
      try {
        const result = await optimizeDayRoute(
          createRouteOptimizationRequest(day, settings),
          (progress) => {
            runState.latestProgress = progress;
            setProgressDialog((dialog) =>
              dialog?.dayId === day.id
                ? { ...dialog, phase: 'running' }
                : dialog,
            );
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
            progress: states[day.id]?.progress ?? null,
            result,
            error: null,
          },
        }));
        setProgressDialog((dialog) =>
          dialog?.dayId === day.id ? { ...dialog, phase: 'completed' } : dialog,
        );
        if (completionCloseTimer.current !== null) {
          window.clearTimeout(completionCloseTimer.current);
        }
        completionCloseTimer.current = window.setTimeout(() => {
          setProgressDialog((dialog) =>
            dialog?.dayId === day.id ? null : dialog,
          );
          completionCloseTimer.current = null;
        }, 400);
      } catch (cause: unknown) {
        if (
          controller.signal.aborted ||
          runState.latestProgress?.status === 'cancelled'
        ) {
          if (
            userCancelledDayIds.current.has(day.id) ||
            runState.latestProgress?.status === 'cancelled'
          ) {
            setDayStates((states) => {
              const previous = states[day.id] ?? createIdleDayState();
              return {
                ...states,
                [day.id]: {
                  status: previous.result ? 'completed' : 'idle',
                  progress: previous.progress,
                  result: previous.result,
                  error: null,
                },
              };
            });
            setProgressDialog((dialog) =>
              dialog?.dayId === day.id
                ? { ...dialog, phase: 'cancelled' }
                : dialog,
            );
          }
          return;
        }
        const message =
          cause instanceof Error
            ? cause.message
            : '경로 최적화 요청에 실패했습니다.';
        setDayStates((states) => ({
          ...states,
          [day.id]: {
            ...(states[day.id] ?? createIdleDayState()),
            status: 'failed',
            error: message,
          },
        }));
        setProgressDialog((dialog) =>
          dialog?.dayId === day.id ? { ...dialog, phase: 'failed' } : dialog,
        );
      } finally {
        userCancelledDayIds.current.delete(day.id);
        if (requestAbortControllers.current.get(day.id) === controller) {
          requestAbortControllers.current.delete(day.id);
        }
      }
    },
    [dayStates],
  );

  useEffect(
    () => () => {
      if (completionCloseTimer.current !== null) {
        window.clearTimeout(completionCloseTimer.current);
      }
      for (const controller of requestAbortControllers.current.values()) {
        controller.abort();
      }
      requestAbortControllers.current.clear();
    },
    [],
  );

  const cancelOptimization = () => {
    if (
      !progressDialog ||
      (progressDialog.phase !== 'submitting' &&
        progressDialog.phase !== 'running')
    ) {
      return;
    }
    const controller = requestAbortControllers.current.get(
      progressDialog.dayId,
    );
    userCancelledDayIds.current.add(progressDialog.dayId);
    setProgressDialog({ ...progressDialog, phase: 'cancelling' });
    controller?.abort();
  };

  const retryOptimization = () => {
    if (!progressDialog || progressDialog.phase !== 'failed') {
      return;
    }
    const day = days.find((entry) => entry.id === progressDialog.dayId);
    if (!day) {
      return;
    }
    const settings = daySettings[day.id] ?? createDayOptimizationSettings(day);
    void runOptimization(day, settings);
  };

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
      closeOnBackdrop={
        !applying && !mapComparisonOpen && !progressDialog && !endpointMenuOpen
      }
      closeOnEscape={
        !applying && !mapComparisonOpen && !progressDialog && !endpointMenuOpen
      }
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
          disabled={applying || progressDialog !== null}
          onClick={onClose}
        />
      </header>

      <div className="route-optimization-modal-body">
        <DayList
          days={days}
          dayStates={dayStates}
          daySettings={daySettings}
          selectedDayId={selectedDay.id}
          onSelect={(dayId) => {
            setEndpointMenuOpen(false);
            setSelectedDayId(dayId);
          }}
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
            <div className="route-optimization-comparison-cards">
              <article className="route-optimization-comparison-card">
                <header className="route-optimization-comparison-card-header">
                  <div>
                    <strong>Before</strong>
                    <span>현재 방문 순서 · 현재 일정</span>
                  </div>
                </header>
                <div className="route-optimization-comparison-card-body">
                  <RouteComparisonMap
                    key={`before-${selectedDay.id}`}
                    title="Before"
                    ariaLabel={`${selectedDay.title} 현재 방문 순서 지도`}
                    layer={`route-optimization-before-${selectedDay.id}`}
                    places={beforePlaces}
                    selectedStartPlaceId={selectedSettings.selectedStartPlaceId}
                    selectedEndPlaceId={selectedSettings.selectedEndPlaceId}
                    editableEndpoints
                    onSetStartPlace={setStartPlace}
                    onSetEndPlace={setEndPlace}
                    onEndpointMenuOpenChange={setEndpointMenuOpen}
                    onExpand={() => setMapComparisonOpen(true)}
                  />
                  <RouteSchedulePreview
                    variant="before"
                    places={beforePlaces}
                    selectedStartPlaceId={selectedSettings.selectedStartPlaceId}
                    selectedEndPlaceId={selectedSettings.selectedEndPlaceId}
                    onSetStartPlace={setStartPlace}
                    onSetEndPlace={setEndPlace}
                  />
                </div>
              </article>

              <article className="route-optimization-comparison-card">
                <header className="route-optimization-comparison-card-header">
                  <div>
                    <strong>After</strong>
                    <span>최적화 방문 순서 · 최적화 일정</span>
                  </div>
                </header>
                <div className="route-optimization-comparison-card-body">
                  {displayCandidate ? (
                    <RouteComparisonMap
                      title="After"
                      ariaLabel={`${selectedDay.title} 최적화 방문 순서 지도`}
                      layer={`route-optimization-after-${selectedDay.id}`}
                      places={afterPlaces}
                      selectedStartPlaceId={
                        selectedSettings.selectedStartPlaceId
                      }
                      selectedEndPlaceId={selectedSettings.selectedEndPlaceId}
                      onExpand={() => setMapComparisonOpen(true)}
                    />
                  ) : (
                    <RouteComparisonPlaceholder
                      message={
                        selectedState.status === 'running'
                          ? '최적화 결과를 기다리고 있습니다.'
                          : '아직 최적화를 실행하지 않았습니다.'
                      }
                    />
                  )}
                  <RouteSchedulePreview
                    variant="after"
                    places={afterPlaces}
                    schedule={optimizedSchedule}
                    selectedStartPlaceId={selectedSettings.selectedStartPlaceId}
                    selectedEndPlaceId={selectedSettings.selectedEndPlaceId}
                    running={selectedState.status === 'running'}
                    hasResult={displayCandidate !== null}
                  />
                </div>
              </article>
            </div>
          </section>

          <RouteOptimizationMetrics
            before={beforePlaces}
            beforeTravelMinutes={beforeTravelMinutes}
            responseTravelMinutes={
              selectedState.result?.total_travel_minutes ?? null
            }
            candidate={displayCandidate}
            schedule={optimizedSchedule}
            startPolicy={selectedSettings.startPolicy}
            requestedStartTime={selectedSettings.startTime}
            running={selectedState.status === 'running'}
          />

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
          {inputIssue ? `실행 불가 · ${inputIssue}` : ''}
        </span>
        <Button
          disabled={applying || progressDialog !== null}
          onClick={onClose}
        >
          취소
        </Button>
        <Button
          loading={selectedState.status === 'running'}
          disabled={
            Boolean(inputIssue) ||
            selectedState.status === 'running' ||
            applying ||
            progressDialog !== null
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
          disabled={
            !canApply ||
            selectedState.status === 'running' ||
            applying ||
            progressDialog !== null
          }
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

      {mapComparisonOpen ? (
        <RouteMapComparisonDialog
          dayId={selectedDay.id}
          dayTitle={selectedDay.title}
          beforePlaces={beforePlaces}
          afterPlaces={afterPlaces}
          hasAfter={displayCandidate !== null}
          selectedStartPlaceId={selectedSettings.selectedStartPlaceId}
          selectedEndPlaceId={selectedSettings.selectedEndPlaceId}
          onClose={() => setMapComparisonOpen(false)}
        />
      ) : null}

      {progressDialog && progressDayState ? (
        <RouteOptimizationProgressDialog
          phase={progressDialog.phase}
          progress={progressDayState.progress}
          error={progressDayState.error}
          onCancel={cancelOptimization}
          onClose={() => setProgressDialog(null)}
          onRetry={retryOptimization}
        />
      ) : null}
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
  const startPolicyHelper =
    settings.startPolicy === 'fixed'
      ? '입력한 시각에 첫 장소 일정을 시작합니다.'
      : settings.startPolicy === 'earliest'
        ? '가능한 가장 빠른 일정 시작 시각을 탐색합니다.'
        : '가능한 가장 늦은 일정 시작 시각을 탐색합니다.';

  return (
    <section className="route-optimization-settings">
      <div className="route-optimization-section-heading">
        <div>
          <h3>최적화 설정</h3>
          <p>
            시작점과 도착점은 아래 경로 비교의 지도 또는 일정에서 지정할 수
            있습니다.
          </p>
        </div>
      </div>
      <div className="route-optimization-settings-groups">
        <section className="route-optimization-settings-group">
          <div className="route-optimization-settings-group-heading">
            <h4>출발 조건</h4>
            <p>출발 시각을 찾는 방식과 이동수단을 설정합니다.</p>
          </div>
          <div className="route-optimization-departure-fields">
            <fieldset className="route-optimization-setting-field route-optimization-start-policy">
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
              <small>{startPolicyHelper}</small>
            </fieldset>
            <label className="route-optimization-setting-field">
              <span>이동수단</span>
              <select
                value={settings.travelMode}
                disabled={disabled}
                aria-label="경로 최적화 이동수단"
                onChange={(event) =>
                  onChange({
                    travelMode: event.target.value as TrouteTravelMode,
                  })
                }
              >
                {TRAVEL_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <small>최적화 요청과 비교 지도에 동일하게 적용</small>
            </label>
          </div>
          {settings.startPolicy === 'fixed' ? (
            <label className="route-optimization-setting-field route-optimization-time-setting">
              <span>시작 시각</span>
              <input
                type="time"
                step={600}
                value={settings.startTime ?? ''}
                disabled={disabled}
                aria-label="고정 시작 시각"
                onChange={(event) =>
                  onChange({ startTime: event.target.value || null })
                }
              />
              <small>10분 단위로 입력</small>
            </label>
          ) : null}
        </section>
      </div>
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
    return state.progress
      ? `${state.progress.progress}% 실행 중`
      : '실행 준비 중';
  }
  if (state.status === 'failed') {
    return state.result ? '결과 유지 · 재실행 실패' : '실패';
  }
  if (state.result) {
    return '최적화 완료';
  }
  return '실행 전';
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
      stayMinutes: getOptimizationStayMinutes(place),
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
