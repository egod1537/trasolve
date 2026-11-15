import { useMemo } from 'react';
import type { RouteComparisonData } from '../model/routeComparison';
import { getRouteComparisonMetrics } from '../model/routeComparisonMetrics';
import { getLanguage, useL } from '@/shared/i18n';
import { formatDurationMinutes } from '@/shared/i18n/formatters';
import { getRouteComparisonStyle } from './routeComparisonStyle';
import {
  getTitle,
  getMessage,
  formatStageMessage,
} from './optimizationProgressPresentation';

type Props = {
  data: RouteComparisonData;
  compact?: boolean;
  headlineOnly?: boolean;
};

export function RouteComparisonSummary({
  data,
  compact = false,
  headlineOnly = false,
}: Props) {
  const L = useL();
  const metrics = useMemo(() => getRouteComparisonMetrics(data), [data]);
  const distance = (meters: number | null) =>
    meters === null
      ? '—'
      : new Intl.NumberFormat(getLanguage(), {
          style: 'unit',
          unit: meters < 1000 ? 'meter' : 'kilometer',
          unitDisplay: 'short',
          maximumFractionDigits: meters < 1000 ? 0 : 1,
        }).format(meters < 1000 ? meters : meters / 1000);
  const duration = (minutes: number | null) =>
    minutes === null ? '—' : formatDurationMinutes(minutes, L);
  const usingTime = metrics.minutesSaved !== null;
  const saved = usingTime ? metrics.minutesSaved : metrics.metersSaved;
  const before = usingTime ? metrics.beforeMinutes : metrics.beforeMeters;
  const unchanged = saved !== null && Math.abs(saved) < 1;
  const percent =
    saved !== null && before !== null && before > 0 && !unchanged
      ? new Intl.NumberFormat(getLanguage(), {
          style: 'percent',
          maximumFractionDigits: 1,
        }).format(Math.abs(saved) / before)
      : null;
  let headline = L(
    'routeOptimization:routeOptimizationMetrics.describeMetricDelta.label.noComparativeData',
  );
  if (unchanged) {
    headline = L(
      'routeOptimization:routeOptimizationMetrics.describeMetricDelta.label.noChange',
    );
  } else if (saved !== null) {
    headline = usingTime
      ? saved > 0
        ? L('routeOptimization:routeReviewSummary.timeSaved', {
            duration: duration(Math.abs(saved)),
          })
        : L('routeOptimization:routeReviewSummary.timeAdded', {
            duration: duration(Math.abs(saved)),
          })
      : saved > 0
        ? L('routeOptimization:routeReviewSummary.distanceSaved', {
            distance: distance(Math.abs(saved)),
          })
        : L('routeOptimization:routeReviewSummary.distanceAdded', {
            distance: distance(Math.abs(saved)),
          });
  }
  const Heading = compact ? 'h3' : 'h1';
  return (
    <section
      className={`route-review-summary${compact ? ' is-compact' : ''}${headlineOnly ? ' is-headline-only' : ''}${saved !== null && saved < 0 ? ' is-increase' : ''}`}
      style={getRouteComparisonStyle('result')}
      aria-label={L('routeOptimization:routeReviewSummary.title')}
    >
      {!headlineOnly && (
        <Heading>
          {data.live
            ? L(
                'routeOptimization:routeOptimizationModal.title.routeOptimization',
              )
            : L('routeOptimization:routeReviewSummary.title')}
        </Heading>
      )}
      {data.live?.hasResult === false ? (
        <p role="status">
          {data.live.status === 'failed'
            ? getTitle('failed')
            : data.live.status === 'cancelled' ||
                data.live.status === 'cancelling'
              ? getMessage(data.live.status, null)
              : formatStageMessage(
                  data.live.illustrative ? 'generating_candidates' : undefined,
                )}
        </p>
      ) : (
        <>
          <div className="route-review-summary-headline">
            <strong>{headline}</strong>
            {percent && (
              <span>
                {saved! > 0
                  ? L('routeOptimization:routeReviewSummary.percentDecrease', {
                      percent,
                    })
                  : L('routeOptimization:routeReviewSummary.percentIncrease', {
                      percent,
                    })}
              </span>
            )}
          </div>
          {!headlineOnly && (
            <>
              <dl className="route-review-summary-values">
                <div>
                  <dt>{L('routeOptimization:routeReviewSummary.timeLabel')}</dt>
                  <dd>
                    <span
                      title={L(
                        'routeOptimization:routeSchedulePreview.beforeSchedule.text.currentSchedule',
                      )}
                    >
                      {duration(metrics.beforeMinutes)}
                    </span>
                    <i aria-hidden="true">→</i>
                    <strong
                      title={L(
                        'routeOptimization:routeSchedulePreview.afterSchedule.text.optimizationSchedule',
                      )}
                    >
                      {duration(metrics.afterMinutes)}
                    </strong>
                  </dd>
                </div>
                <div>
                  <dt>
                    {L('routeOptimization:routeReviewSummary.distanceLabel')}
                  </dt>
                  <dd>
                    <span
                      title={L(
                        'routeOptimization:routeSchedulePreview.beforeSchedule.text.currentSchedule',
                      )}
                    >
                      {distance(metrics.beforeMeters)}
                    </span>
                    <i aria-hidden="true">→</i>
                    <strong
                      title={L(
                        'routeOptimization:routeSchedulePreview.afterSchedule.text.optimizationSchedule',
                      )}
                    >
                      {distance(metrics.afterMeters)}
                    </strong>
                  </dd>
                </div>
              </dl>
              <p className="route-review-summary-basis">
                {L('routeOptimization:routeReviewSummary.basis')}
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
