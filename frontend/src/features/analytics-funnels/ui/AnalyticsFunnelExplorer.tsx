import { useMemo, useState } from 'react';
import type {
  AnalyticsFunnelResultResponse,
  AnalyticsLocale,
  FunnelStepResult,
} from '@trasolve/shared';
import { getLanguage, useL } from '@/shared/i18n';
import {
  useAnalyticsFunnelList,
  useAnalyticsFunnelResult,
} from '../model/useAnalyticsFunnels';
import './analytics-funnels.css';

const defaultFunnelId = 'route_optimization';

export function AnalyticsFunnelExplorer({
  period,
}: {
  period: { from?: string; to?: string };
}) {
  const L = useL();
  const locale = getLanguage() as AnalyticsLocale;
  const [funnelId, setFunnelId] = useState(defaultFunnelId);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const funnelList = useAnalyticsFunnelList();
  const funnelResult = useAnalyticsFunnelResult(funnelId, period, locale);

  if (funnelList.state.status === 'error') {
    return (
      <StatusPanel
        message={L('analytics:status.loadError')}
        retryLabel={L('common:action.retry')}
        onRetry={funnelList.reload}
      />
    );
  }

  const funnels =
    funnelList.state.status === 'ready' ? funnelList.state.data.funnels : [];
  return (
    <section className="analytics-funnel-explorer">
      <header className="analytics-funnel-toolbar">
        <label>
          <span>{L('analytics:funnels.selector.label')}</span>
          <select
            value={funnelId}
            disabled={funnels.length === 0}
            onChange={(event) => {
              setFunnelId(event.target.value);
              setSelectedStepId(null);
            }}
          >
            {funnels.map((funnel) => (
              <option key={funnel.id} value={funnel.id}>
                {getFunnelLabel(funnel.id, L)}
              </option>
            ))}
          </select>
        </label>
      </header>

      {funnelResult.state.status === 'loading' ? (
        <p className="analytics-funnel-status" role="status">
          {L('analytics:status.loading')}
        </p>
      ) : null}
      {funnelResult.state.status === 'error' ? (
        <StatusPanel
          message={L('analytics:status.loadError')}
          retryLabel={L('common:action.retry')}
          onRetry={funnelResult.reload}
        />
      ) : null}
      {funnelResult.state.status === 'ready' ? (
        <FunnelResultView
          result={funnelResult.state.data}
          selectedStepId={selectedStepId}
          onSelectStep={setSelectedStepId}
          locale={locale}
        />
      ) : null}
    </section>
  );
}

function FunnelResultView({
  result,
  selectedStepId,
  onSelectStep,
  locale,
}: {
  result: AnalyticsFunnelResultResponse;
  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;
  locale: AnalyticsLocale;
}) {
  const L = useL();
  const startedSessions = result.steps[0]?.enteredSessions ?? 0;
  const completedSessions = result.steps.at(-1)?.enteredSessions ?? 0;
  const overallConversion = result.steps.at(-1)?.overallConversion ?? 0;
  const largestDropOff = useMemo(
    () =>
      result.steps.reduce<FunnelStepResult | null>(
        (largest, step) =>
          largest === null || step.dropOffSessions > largest.dropOffSessions
            ? step
            : largest,
        null,
      ),
    [result.steps],
  );
  const selectedStep =
    result.steps.find((step) => step.stepId === selectedStepId) ??
    result.steps[0];

  if (startedSessions === 0) {
    return (
      <p className="analytics-funnel-status">
        {L('analytics:funnels.status.noData')}
      </p>
    );
  }

  return (
    <>
      <dl className="analytics-funnel-kpis">
        <Kpi
          label={L('analytics:funnels.kpi.startedSessions')}
          value={formatNumber(startedSessions, locale)}
        />
        <Kpi
          label={L('analytics:funnels.kpi.completedSessions')}
          value={formatNumber(completedSessions, locale)}
        />
        <Kpi
          label={L('analytics:funnels.kpi.overallConversion')}
          value={formatPercent(overallConversion, locale)}
        />
        <Kpi
          label={L('analytics:funnels.kpi.largestDropOff')}
          value={
            largestDropOff
              ? `${formatNumber(largestDropOff.dropOffSessions, locale)} · ${formatPercent(largestDropOff.dropOffRate, locale)}`
              : formatNumber(0, locale)
          }
          detail={
            largestDropOff ? getStepLabel(largestDropOff.stepId, L) : undefined
          }
        />
        <Kpi
          label={L('analytics:funnels.kpi.averageCompletionTime')}
          value={formatDuration(result.averageCompletionTimeMs, locale, L)}
        />
      </dl>

      <ol className="analytics-funnel-steps">
        {result.steps.map((step, index) => {
          const isLargestDropOff = largestDropOff?.stepId === step.stepId;
          const isSelected = selectedStep?.stepId === step.stepId;
          return (
            <li key={step.stepId}>
              <button
                type="button"
                className={`analytics-funnel-step${isLargestDropOff ? ' is-largest-drop-off' : ''}${isSelected ? ' is-selected' : ''}`}
                aria-pressed={isSelected}
                onClick={() => onSelectStep(step.stepId)}
              >
                <span className="analytics-funnel-step-index">{index + 1}</span>
                <strong>{getStepLabel(step.stepId, L)}</strong>
                <dl>
                  <Metric
                    label={L('analytics:funnels.metric.enteredSessions')}
                    value={formatNumber(step.enteredSessions, locale)}
                  />
                  <Metric
                    label={L('analytics:funnels.metric.previousConversion')}
                    value={formatNullablePercent(
                      step.conversionFromPrevious,
                      locale,
                      L,
                    )}
                  />
                  <Metric
                    label={L('analytics:funnels.metric.dropOff')}
                    value={`${formatNumber(step.dropOffSessions, locale)} · ${formatPercent(step.dropOffRate, locale)}`}
                  />
                </dl>
              </button>
              {index < result.steps.length - 1 ? (
                <div className="analytics-funnel-connector" aria-hidden="true">
                  <span>
                    {formatPercent(
                      result.steps[index + 1].conversionFromPrevious ?? 0,
                      locale,
                    )}
                  </span>
                  <small>
                    {formatDuration(
                      result.steps[index + 1].averageTimeFromPreviousMs,
                      locale,
                      L,
                    )}
                  </small>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {selectedStep ? (
        <aside className="analytics-funnel-detail">
          <h2>{getStepLabel(selectedStep.stepId, L)}</h2>
          <dl>
            <Metric
              label={L('analytics:funnels.metric.enteredSessions')}
              value={formatNumber(selectedStep.enteredSessions, locale)}
            />
            <Metric
              label={L('analytics:funnels.metric.previousConversion')}
              value={formatNullablePercent(
                selectedStep.conversionFromPrevious,
                locale,
                L,
              )}
            />
            <Metric
              label={L('analytics:funnels.metric.overallConversion')}
              value={formatPercent(selectedStep.overallConversion, locale)}
            />
            <Metric
              label={L('analytics:funnels.metric.dropOff')}
              value={`${formatNumber(selectedStep.dropOffSessions, locale)} · ${formatPercent(selectedStep.dropOffRate, locale)}`}
            />
            <Metric
              label={L('analytics:funnels.metric.averageTime')}
              value={formatDuration(
                selectedStep.averageTimeFromPreviousMs,
                locale,
                L,
              )}
            />
            <Metric
              label={L('analytics:funnels.metric.medianTime')}
              value={formatDuration(
                selectedStep.medianTimeFromPreviousMs,
                locale,
                L,
              )}
            />
          </dl>
        </aside>
      ) : null}
    </>
  );
}

function Kpi({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function StatusPanel({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <div className="analytics-funnel-status" role="alert">
      <p>{message}</p>
      <button type="button" onClick={onRetry}>
        {retryLabel}
      </button>
    </div>
  );
}

function getFunnelLabel(funnelId: string, L: ReturnType<typeof useL>): string {
  switch (funnelId) {
    case 'route_optimization':
      return L('analytics:funnels.funnel.routeOptimization');
    case 'trip_entry':
      return L('analytics:funnels.funnel.tripEntry');
    case 'add_place':
      return L('analytics:funnels.funnel.addPlace');
    case 'route_reoptimization':
      return L('analytics:funnels.funnel.routeReoptimization');
    case 'trip_share':
      return L('analytics:funnels.funnel.tripShare');
    default:
      return funnelId;
  }
}

function getStepLabel(stepId: string, L: ReturnType<typeof useL>): string {
  switch (stepId) {
    case 'map_workspace_viewed':
      return L('analytics:funnels.step.mapWorkspaceViewed');
    case 'optimization_started':
      return L('analytics:funnels.step.optimizationStarted');
    case 'optimization_completed':
      return L('analytics:funnels.step.optimizationCompleted');
    case 'result_viewed':
      return L('analytics:funnels.step.resultViewed');
    case 'optimization_applied':
      return L('analytics:funnels.step.optimizationApplied');
    case 'landing_viewed':
      return L('analytics:funnels.step.landingViewed');
    case 'landing_action':
      return L('analytics:funnels.step.landingAction');
    case 'trip_picker_viewed':
      return L('analytics:funnels.step.tripPickerViewed');
    case 'trip_opened':
      return L('analytics:funnels.step.tripOpened');
    case 'place_search_viewed':
      return L('analytics:funnels.step.placeSearchViewed');
    case 'place_selected':
      return L('analytics:funnels.step.placeSelected');
    case 'add_place_clicked':
      return L('analytics:funnels.step.addPlaceClicked');
    case 'place_added':
      return L('analytics:funnels.step.placeAdded');
    case 'initial_result_viewed':
      return L('analytics:funnels.step.initialResultViewed');
    case 'route_modified':
      return L('analytics:funnels.step.routeModified');
    case 'reoptimization_started':
      return L('analytics:funnels.step.reoptimizationStarted');
    case 'reoptimization_completed':
      return L('analytics:funnels.step.reoptimizationCompleted');
    case 'updated_result_viewed':
      return L('analytics:funnels.step.updatedResultViewed');
    case 'share_modal_opened':
      return L('analytics:funnels.step.shareModalOpened');
    case 'share_enabled':
      return L('analytics:funnels.step.shareEnabled');
    case 'share_link_copied':
      return L('analytics:funnels.step.shareLinkCopied');
    default:
      return stepId;
  }
}

function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

function formatPercent(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatNullablePercent(
  value: number | null,
  locale: string,
  L: ReturnType<typeof useL>,
): string {
  return value === null
    ? L('analytics:metric.notApplicable')
    : formatPercent(value, locale);
}

function formatDuration(
  milliseconds: number | null,
  locale: string,
  L: ReturnType<typeof useL>,
): string {
  if (milliseconds === null) {
    return L('analytics:metric.notApplicable');
  }
  const seconds = milliseconds / 1000;
  const unit = seconds >= 3600 ? 'hour' : seconds >= 60 ? 'minute' : 'second';
  const value =
    unit === 'hour'
      ? seconds / 3600
      : unit === 'minute'
        ? seconds / 60
        : seconds;
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit,
    unitDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(value);
}
