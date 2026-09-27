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
  RouteOptimizationValidationError,
  type RouteOptimizationIssue,
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
import { useL, L, type Localize } from '@/shared/i18n';

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
  {
    value: 'TRANSIT',
    get label() {
      return L(
        'routeOptimization:routeOptimizationModal.tRAVELMODEOPTIONS.label.publicTransportation',
      );
    },
  },
  {
    value: 'DRIVING',
    get label() {
      return L(
        'routeOptimization:routeOptimizationModal.tRAVELMODEOPTIONS.label.car',
      );
    },
  },
  {
    value: 'WALKING',
    get label() {
      return L(
        'routeOptimization:routeOptimizationModal.tRAVELMODEOPTIONS.label.walk',
      );
    },
  },
  {
    value: 'BICYCLING',
    get label() {
      return L(
        'routeOptimization:routeOptimizationModal.tRAVELMODEOPTIONS.label.bicycle',
      );
    },
  },
];

const START_POLICY_OPTIONS: readonly {
  value: RouteOptimizationStartPolicy;
  label: string;
}[] = [
  {
    value: 'fixed',
    get label() {
      return L(
        'routeOptimization:routeOptimizationApi.formatStartPolicy.text.designatedTime',
      );
    },
  },
  {
    value: 'earliest',
    get label() {
      return L(
        'routeOptimization:routeOptimizationApi.formatStartPolicy.text.asSoonAsPossible',
      );
    },
  },
  {
    value: 'latest',
    get label() {
      return L(
        'routeOptimization:routeOptimizationApi.formatStartPolicy.text.asLateAsPossible',
      );
    },
  },
];

const resultCache = new Map<string, TrouteOptimizeResponse>();

export function RouteOptimizationModal({
  id,
  days,
  initialDayId,
  onClose,
  onApply,
}: Props) {
  const L = useL();
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
  const inputIssueText = inputIssue
    ? formatRouteOptimizationIssue(inputIssue, L)
    : null;
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
          cause instanceof RouteOptimizationValidationError
            ? formatRouteOptimizationIssue(cause.issue, L)
            : cause instanceof Error
              ? cause.message
              : L(
                  'routeOptimization:routeOptimizationModal.text.routeOptimizationRequestFailed',
                );
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
    [dayStates, L],
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
        setDayError(
          selectedDay.id,
          L(
            'routeOptimization:routeOptimizationModal.text.failedApplyOptimizationResultsDay',
          ),
        );
        return;
      }
      onClose();
    } catch {
      setDayError(
        selectedDay.id,
        L(
          'routeOptimization:routeOptimizationModal.text.failedApplyOptimizationResultsDay',
        ),
      );
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
          <h2 id={titleId}>
            {L(
              'routeOptimization:routeOptimizationModal.title.routeOptimization',
            )}
          </h2>
          <p id={descriptionId}>
            {L(
              'routeOptimization:routeOptimizationModal.description.compareCurrentRouteOptimizedRouteBy',
            )}
          </p>
        </div>
        <IconButton
          className="route-optimization-modal-close"
          aria-label={L(
            'routeOptimization:routeOptimizationModal.ariaLabel.closeRouteOptimization',
          )}
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
              <span>
                {L('routeOptimization:routeOptimizationModal.text.selectDay')}
              </span>
              <h3>
                {L(
                  'routeOptimization:routeOptimizationModal.text.pathOptimization',
                  { title: selectedDay.title },
                )}
              </h3>
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
                <h3>
                  {L(
                    'routeOptimization:routeOptimizationModal.title.pathComparison',
                  )}
                </h3>
                <p>
                  {L(
                    'routeOptimization:routeOptimizationModal.description.compareCurrentVisitSequenceOptimizedVisit',
                  )}
                </p>
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
                    <strong>
                      {L('routeOptimization:comparison.label.before')}
                    </strong>
                    <span>
                      {L(
                        'routeOptimization:routeOptimizationModal.text.currentVisitOrderCurrentSchedule',
                      )}
                    </span>
                  </div>
                </header>
                <div className="route-optimization-comparison-card-body">
                  <RouteComparisonMap
                    key={`before-${selectedDay.id}`}
                    phase="before"
                    ariaLabel={L(
                      'routeOptimization:routeOptimizationModal.ariaLabel.currentVisitOrderMap',
                      { title: selectedDay.title },
                    )}
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
                    <strong>
                      {L('routeOptimization:comparison.label.after')}
                    </strong>
                    <span>
                      {L(
                        'routeOptimization:routeOptimizationModal.text.optimizationVisitOrderOptimizationSchedule',
                      )}
                    </span>
                  </div>
                </header>
                <div className="route-optimization-comparison-card-body">
                  {displayCandidate ? (
                    <RouteComparisonMap
                      phase="after"
                      ariaLabel={L(
                        'routeOptimization:routeOptimizationModal.ariaLabel.optimizedVisitOrderMap',
                        { title: selectedDay.title },
                      )}
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
                          ? L(
                              'routeOptimization:routeOptimizationModal.text.awaitingOptimizationResults',
                            )
                          : L(
                              'routeOptimization:routeMapComparisonDialog.text.noOptimizationHasBeenRunYet',
                            )
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
              {L(
                'routeOptimization:routeOptimizationModal.text.noBusinessHoursInformationOptimizationRequests',
                {
                  placeNames:
                    diagnostics.openingHoursFallbackPlaceNames.join(', '),
                },
              )}
            </p>
          ) : null}
          {selectedState.error ? (
            <p className="route-optimization-modal-error" role="alert">
              {selectedState.error}
              {selectedState.result
                ? ` ${L(
                    'routeOptimization:routeOptimizationModal.description.anyExistingSuccessResultsWillRemain',
                  )}`
                : ''}
            </p>
          ) : null}
        </main>
      </div>

      <footer className="route-optimization-modal-actions">
        <span
          className={`route-optimization-progress${inputIssue ? ' is-blocked' : ''}`}
          title={inputIssueText ?? undefined}
          aria-live="polite"
        >
          {inputIssue
            ? L('routeOptimization:routeOptimizationModal.text.notExecutable', {
                inputIssue: inputIssueText,
              })
            : ''}
        </span>
        <Button
          disabled={applying || progressDialog !== null}
          onClick={onClose}
        >
          {L('common:action.cancel')}
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
          title={inputIssueText ?? undefined}
          onClick={() => void runOptimization(selectedDay, selectedSettings)}
        >
          {selectedState.result
            ? L('routeOptimization:routeOptimizationModal.action.runAgain')
            : L(
                'routeOptimization:routeOptimizationModal.action.optimizationRun',
              )}
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
              ? L(
                  'routeOptimization:routeOptimizationModal.tooltip.itCannotBeAppliedBecauseSchedule',
                )
              : undefined
          }
          onClick={() => void applyCandidate()}
        >
          {L('routeOptimization:routeOptimizationModal.action.applyThisResult')}
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
  const L = useL();
  return (
    <aside
      className="route-optimization-days"
      aria-label={L(
        'routeOptimization:routeOptimizationModal.dayList.ariaLabel.selectDay',
      )}
    >
      <h3>
        {L(
          'routeOptimization:routeOptimizationModal.dayList.ariaLabel.selectDay',
        )}
      </h3>
      <div className="route-optimization-day-list">
        {days.map((day) => {
          const state = dayStates[day.id] ?? createIdleDayState();
          const settings =
            daySettings[day.id] ?? createDayOptimizationSettings(day);
          const inputIssue = getRouteOptimizationIssue(day, settings);
          const inputIssueText = inputIssue
            ? formatRouteOptimizationIssue(inputIssue, L)
            : null;
          return (
            <button
              key={day.id}
              type="button"
              className={`${selectedDayId === day.id ? 'is-selected' : ''} is-${state.status}${inputIssue ? ' has-input-issue' : ''}`}
              aria-pressed={selectedDayId === day.id}
              title={inputIssueText ?? undefined}
              onClick={() => onSelect(day.id)}
            >
              <span className="route-optimization-day-name">
                <strong>{day.title}</strong>
                <span>
                  {L('routeOptimization:routeOptimizationModal.text.where', {
                    length: day.places.length,
                  })}
                </span>
              </span>
              <span className="route-optimization-day-status">
                {inputIssue
                  ? L(
                      'routeOptimization:routeOptimizationModal.dayList.text.inputConfirmationRequired',
                    )
                  : formatDayStatus(state)}
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
  const L = useL();
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
      ? L(
          'routeOptimization:routeOptimizationModal.optimizationSettings.text.firstLocationScheduleStartsAtTime',
        )
      : settings.startPolicy === 'earliest'
        ? L(
            'routeOptimization:routeOptimizationModal.optimizationSettings.text.exploreEarliestPossibleScheduleStartTime',
          )
        : L(
            'routeOptimization:routeOptimizationModal.optimizationSettings.text.exploreLatestPossibleEventStartTime',
          );

  return (
    <section className="route-optimization-settings">
      <div className="route-optimization-section-heading">
        <div>
          <h3>
            {L(
              'routeOptimization:routeOptimizationModal.optimizationSettings.title.optimizationSettings',
            )}
          </h3>
          <p>
            {L(
              'routeOptimization:routeOptimizationModal.optimizationSettings.description.startingEndingPointsCanBeSpecified',
            )}
          </p>
        </div>
      </div>
      <div className="route-optimization-settings-groups">
        <section className="route-optimization-settings-group">
          <div className="route-optimization-settings-group-heading">
            <h4>
              {L(
                'routeOptimization:routeOptimizationModal.optimizationSettings.title.departureConditions',
              )}
            </h4>
            <p>
              {L(
                'routeOptimization:routeOptimizationModal.optimizationSettings.description.setMethodFindingDepartureTimeMeans',
              )}
            </p>
          </div>
          <div className="route-optimization-departure-fields">
            <fieldset className="route-optimization-setting-field route-optimization-start-policy">
              <legend>
                {L(
                  'routeOptimization:routeOptimizationModal.optimizationSettings.label.startupMethod',
                )}
              </legend>
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
              <span>
                {L(
                  'routeOptimization:routeOptimizationModal.optimizationSettings.text.meansTransportation',
                )}
              </span>
              <select
                value={settings.travelMode}
                disabled={disabled}
                aria-label={L(
                  'routeOptimization:routeOptimizationModal.optimizationSettings.ariaLabel.routeOptimizationTransportation',
                )}
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
              <small>
                {L(
                  'routeOptimization:routeOptimizationModal.optimizationSettings.description.sameAppliesOptimizationRequestsComparisonMaps',
                )}
              </small>
            </label>
          </div>
          {settings.startPolicy === 'fixed' ? (
            <label className="route-optimization-setting-field route-optimization-time-setting">
              <span>
                {L(
                  'routeOptimization:routeOptimizationModal.optimizationSettings.text.startTime',
                )}
              </span>
              <input
                type="time"
                step={600}
                value={settings.startTime ?? ''}
                disabled={disabled}
                aria-label={L(
                  'routeOptimization:routeOptimizationModal.optimizationSettings.ariaLabel.fixedStartTime',
                )}
                onChange={(event) =>
                  onChange({ startTime: event.target.value || null })
                }
              />
              <small>
                {L(
                  'routeOptimization:routeOptimizationModal.optimizationSettings.description.enter10MinuteIncrements',
                )}
              </small>
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
  inputIssue: RouteOptimizationIssue | null;
}) {
  const L = useL();
  return (
    <span
      className={`route-optimization-status ${inputIssue ? 'is-blocked' : `is-${state.status}`}`}
    >
      {inputIssue
        ? L(
            'routeOptimization:routeOptimizationModal.dayList.text.inputConfirmationRequired',
          )
        : formatDayStatus(state)}
    </span>
  );
}

function OptimizationValidationPanel({
  id,
  issue,
}: {
  id: string;
  issue: RouteOptimizationIssue;
}) {
  const L = useL();
  return (
    <section id={id} className="route-optimization-validation" role="alert">
      <span className="route-optimization-validation-icon" aria-hidden="true">
        !
      </span>
      <div>
        <strong>
          {L(
            'routeOptimization:routeOptimizationModal.optimizationValidationPanel.text.unableRunOptimization',
          )}
        </strong>
        <p>{formatRouteOptimizationIssue(issue, L)}</p>
        <span>{getValidationResolution(issue, L)}</span>
      </div>
    </section>
  );
}

function getValidationResolution(
  issue: RouteOptimizationIssue,
  L: Localize,
): string {
  if (
    issue.code === 'startOutsideDay' ||
    issue.code === 'endOutsideDay' ||
    issue.code === 'sameEndpoints'
  ) {
    return L(
      'routeOptimization:routeOptimizationModal.getValidationResolution.text.selectDifferentLocationsCurrentDayAs',
    );
  }
  if (issue.code === 'fixedStartRequired' || issue.code === 'fixedStartStep') {
    return L(
      'routeOptimization:routeOptimizationModal.getValidationResolution.text.enterStartTime10MinuteIncrements',
    );
  }
  if (issue.code === 'missingPlaceId') {
    return L(
      'routeOptimization:routeOptimizationModal.getValidationResolution.text.selectPlaceDisplayedPlaceSearchAgain',
    );
  }
  if (issue.code === 'minimumPlaces') {
    return L(
      'routeOptimization:routeOptimizationModal.getValidationResolution.text.addAtLeastTwoLocationsThis',
    );
  }
  if (issue.code === 'unsupportedTravelMode') {
    return L(
      'routeOptimization:routeOptimizationModal.getValidationResolution.text.setDaySModeTransportationAs',
    );
  }
  return L(
    'routeOptimization:routeOptimizationModal.getValidationResolution.text.checkLocationSBusinessHoursStay',
  );
}

function formatRouteOptimizationIssue(
  issue: RouteOptimizationIssue,
  L: Localize,
): string {
  switch (issue.code) {
    case 'minimumPlaces':
      return L(
        'routeOptimization:routeOptimization.getRouteOptimizationIssue.text.routeOptimizationRequiresTwoMoreLocations',
        issue.values,
      );
    case 'startOutsideDay':
      return L(
        'routeOptimization:routeOptimization.getRouteOptimizationIssue.text.startingPointMustBeLocationIncluded',
        issue.values,
      );
    case 'endOutsideDay':
      return L(
        'routeOptimization:routeOptimization.getRouteOptimizationIssue.text.endpointMustBeLocationIncludedCurrent',
        issue.values,
      );
    case 'sameEndpoints':
      return L(
        'routeOptimization:routeOptimization.getRouteOptimizationIssue.text.startingEndingPointsMustBeDifferent',
        issue.values,
      );
    case 'unsupportedStartPolicy':
      return L(
        'routeOptimization:routeOptimization.getRouteOptimizationIssue.text.thisStartupMethodNotSupported',
        issue.values,
      );
    case 'fixedStartRequired':
      return L(
        'routeOptimization:routeOptimization.getRouteOptimizationIssue.text.specifiedTimeStartRequiresStartTime',
        issue.values,
      );
    case 'fixedStartStep':
      return L(
        'routeOptimization:routeOptimization.getRouteOptimizationIssue.text.specifiedStartTimeMustBe10',
        issue.values,
      );
    case 'unsupportedTravelMode':
      return L(
        'routeOptimization:routeOptimization.getRouteOptimizationIssue.text.thisTransportationMethodNotSupported',
        issue.values,
      );
    case 'missingPlaceId':
      return L(
        'routeOptimization:routeOptimization.getRouteOptimizationIssue.text.placeIdRequiredCheckActualTravel',
        issue.values,
      );
    case 'invalidRequest':
      return L(
        'routeOptimization:routeOptimization.error.routeOptimizationRequestValueIncorrect',
        issue.values,
      );
    case 'stayStep':
      return L(
        'routeOptimization:routeOptimization.getLocationConstraint.text.stayTimeMustBe10Minute',
        issue.values,
      );
    case 'nextDayOpeningHours':
      return L(
        'routeOptimization:routeOptimization.getOpeningWindow.text.nextBusinessHoursNotCurrentlySupported',
        issue.values,
      );
    case 'noOpeningHours':
      return L(
        'routeOptimization:routeOptimization.getOpeningWindow.text.hasNoValidBusinessHoursSelected',
        issue.values,
      );
    case 'openingTimeStep':
      return L(
        'routeOptimization:routeOptimization.getOpeningWindow.text.openingTimeMustBe10Minute',
        issue.values,
      );
    case 'closingTimeStep':
      return L(
        'routeOptimization:routeOptimization.getOpeningWindow.text.closingTimeMustBe10Minute',
        issue.values,
      );
  }
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
      ? L(
          'routeOptimization:routeOptimizationModal.formatDayStatus.text.running',
          { progress: state.progress.progress },
        )
      : L(
          'routeOptimization:routeOptimizationModal.formatDayStatus.text.preparingRun',
        );
  }
  if (state.status === 'failed') {
    return state.result
      ? L(
          'routeOptimization:routeOptimizationModal.formatDayStatus.text.resultMaintenanceRerunFailure',
        )
      : L(
          'routeOptimization:routeOptimizationModal.formatDayStatus.text.failure',
        );
  }
  if (state.result) {
    return L(
      'routeOptimization:routeOptimizationModal.formatDayStatus.text.optimized',
    );
  }
  return L(
    'routeOptimization:routeOptimizationModal.formatDayStatus.text.beforeRunning',
  );
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
