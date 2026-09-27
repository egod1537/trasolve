import type { TrouteSolverCandidate, TripPlace } from '@trasolve/shared';
import type {
  RouteOptimizationSchedule,
  RouteOptimizationStartPolicy,
} from '@/features/route-optimization/model/routeOptimization';
import { useL, L } from '@/shared/i18n';

type Props = {
  before: readonly TripPlace[];
  beforeTravelMinutes: number | null;
  responseTravelMinutes: number | null;
  candidate: TrouteSolverCandidate | null;
  schedule: RouteOptimizationSchedule | null;
  startPolicy: RouteOptimizationStartPolicy;
  requestedStartTime: string | null;
  running: boolean;
};

type MetricKind = 'duration' | 'time';
type MetricType = 'travel' | 'wait' | 'start' | 'finish';
type MetricValue = number | string | null;
type MetricTone = 'improvement' | 'warning' | 'neutral';

type Metric = {
  key: MetricType;
  label: string;
  kind: MetricKind;
  before: MetricValue;
  after: MetricValue;
};

export function RouteOptimizationMetrics({
  before,
  beforeTravelMinutes,
  responseTravelMinutes,
  candidate,
  schedule,
  startPolicy,
  requestedStartTime,
  running,
}: Props) {
  const L = useL();
  const metrics = createMetrics(
    before,
    beforeTravelMinutes,
    responseTravelMinutes,
    candidate,
    schedule,
  ).filter((metric) => metric.before !== null || metric.after !== null);

  return (
    <section className="route-optimization-metrics">
      <header>
        <h3>
          {L(
            'routeOptimization:routeOptimizationMetrics.title.indicatorChange',
          )}
        </h3>
        <p>
          {L(
            'routeOptimization:routeOptimizationMetrics.description.compareKeyFiguresFromCurrentSchedule',
          )}
        </p>
      </header>
      {candidate ? (
        <div className="route-optimization-metric-grid">
          {metrics.map((metric) => {
            const delta = describeMetricDelta(
              metric,
              startPolicy,
              requestedStartTime,
            );
            return (
              <article
                key={metric.key}
                className={`route-optimization-metric-card is-${delta.tone}`}
              >
                <h4>{metric.label}</h4>
                <div className="route-optimization-metric-values">
                  <span>
                    <small>
                      {L('routeOptimization:comparison.label.before')}
                    </small>
                    <strong>
                      {formatMetricValue(metric.before, metric.kind)}
                    </strong>
                  </span>
                  <i aria-hidden="true">→</i>
                  <span>
                    <small>
                      {L('routeOptimization:comparison.label.after')}
                    </small>
                    <strong>
                      {formatMetricValue(metric.after, metric.kind)}
                    </strong>
                  </span>
                </div>
                <p className="route-optimization-metric-delta">
                  <span aria-hidden="true">{delta.symbol}</span>
                  <strong>{delta.label}</strong>
                </p>
              </article>
            );
          })}
        </div>
      ) : (
        <p
          className={`route-optimization-metrics-placeholder${running ? ' is-running' : ''}`}
          role="status"
        >
          {running
            ? L(
                'routeOptimization:routeOptimizationMetrics.description.calculatingRouteMetrics',
              )
            : L(
                'routeOptimization:routeOptimizationMetrics.description.whenYouRunOptimizationYouCan',
              )}
        </p>
      )}
    </section>
  );
}

function createMetrics(
  before: readonly TripPlace[],
  beforeTravelMinutes: number | null,
  responseTravelMinutes: number | null,
  candidate: TrouteSolverCandidate | null,
  schedule: RouteOptimizationSchedule | null,
): Metric[] {
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
  return [
    {
      key: 'travel',
      label: L(
        'routeOptimization:routeOptimizationMetrics.createMetrics.label.totalTravelTime',
      ),
      kind: 'duration',
      before: beforeTravelMinutes,
      after:
        score?.travel_minutes ??
        responseTravelMinutes ??
        getScheduleTravelMinutes(schedule),
    },
    {
      key: 'wait',
      label: L(
        'routeOptimization:routeOptimizationMetrics.createMetrics.label.totalWaitingTime',
      ),
      kind: 'duration',
      before: beforeWait,
      after:
        score?.wait_minutes ??
        (schedule
          ? schedule.stops.reduce((total, stop) => total + stop.waitMinutes, 0)
          : null),
    },
    {
      key: 'start',
      label: L(
        'routeOptimization:routeOptimizationMetrics.createMetrics.label.scheduleStartTime',
      ),
      kind: 'time',
      before: beforeStart,
      after:
        schedule?.stops[0]?.serviceStartTime ?? score?.latest_start ?? null,
    },
    {
      key: 'finish',
      label: L(
        'routeOptimization:routeOptimizationMetrics.createMetrics.label.scheduleEndTime',
      ),
      kind: 'time',
      before: beforeFinish,
      after:
        schedule?.stops.at(-1)?.departureTime ?? score?.finish_time ?? null,
    },
  ];
}

function describeMetricDelta(
  metric: Metric,
  startPolicy: RouteOptimizationStartPolicy,
  requestedStartTime: string | null,
): { label: string; symbol: string; tone: MetricTone } {
  const difference = calculateMetricDelta(
    metric.before,
    metric.after,
    metric.kind,
  );
  if (difference === null) {
    return {
      label: L(
        'routeOptimization:routeOptimizationMetrics.describeMetricDelta.label.noComparativeData',
      ),
      symbol: '·',
      tone: 'neutral',
    };
  }
  if (difference === 0) {
    const fixedStartMatches =
      metric.key === 'start' &&
      startPolicy === 'fixed' &&
      metric.after === requestedStartTime;
    return {
      label: fixedStartMatches
        ? L(
            'routeOptimization:routeOptimizationMetrics.describeMetricDelta.label.matchesSpecifiedTime',
          )
        : L(
            'routeOptimization:routeOptimizationMetrics.describeMetricDelta.label.noChange',
          ),
      symbol: '→',
      tone: 'neutral',
    };
  }

  const absolute = Math.abs(difference);
  if (metric.kind === 'time') {
    const earlier = difference < 0;
    return {
      label: L(
        'routeOptimization:routeOptimizationMetrics.describeMetricDelta.label.minutes',
        {
          absolute: absolute,
          value: earlier
            ? L(
                'routeOptimization:routeOptimizationMetrics.describeMetricDelta.label.faster',
              )
            : L(
                'routeOptimization:routeOptimizationMetrics.describeMetricDelta.label.late',
              ),
        },
      ),
      symbol: earlier ? '↓' : '↑',
      tone: assessTimeTone(
        metric.key,
        difference,
        startPolicy,
        requestedStartTime,
        metric.after,
      ),
    };
  }
  return {
    label: L(
      'routeOptimization:routeOptimizationMetrics.describeMetricDelta.label.minutes',
      {
        absolute: absolute,
        value:
          difference < 0
            ? L(
                'routeOptimization:routeOptimizationMetrics.describeMetricDelta.label.decrease',
              )
            : L(
                'routeOptimization:routeOptimizationMetrics.describeMetricDelta.label.increase',
              ),
      },
    ),
    symbol: difference < 0 ? '↓' : '↑',
    tone: difference < 0 ? 'improvement' : 'warning',
  };
}

function assessTimeTone(
  metric: MetricType,
  difference: number,
  startPolicy: RouteOptimizationStartPolicy,
  requestedStartTime: string | null,
  after: MetricValue,
): MetricTone {
  if (metric === 'finish') {
    return difference < 0 ? 'improvement' : 'warning';
  }
  if (metric !== 'start') {
    return 'neutral';
  }
  if (startPolicy === 'fixed') {
    return after === requestedStartTime ? 'neutral' : 'warning';
  }
  const desiredDirection = startPolicy === 'latest' ? 1 : -1;
  return Math.sign(difference) === desiredDirection ? 'improvement' : 'warning';
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
  const waitMinutes = elapsed - travelMinutes - stayMinutes;
  return waitMinutes >= 0 ? waitMinutes : null;
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

function getStayMinutes(place: TripPlace): number {
  return place.preferredDurationMinutes ?? place.visitDurationMinutes ?? 0;
}

function formatMetricValue(value: MetricValue, kind: MetricKind): string {
  if (value === null) {
    return '—';
  }
  return kind === 'duration'
    ? L(
        'routeOptimization:routeOptimizationMetrics.formatMetricValue.text.minutes',
        { value: value },
      )
    : String(value);
}

function calculateMetricDelta(
  before: MetricValue,
  after: MetricValue,
  kind: MetricKind,
): number | null {
  if (before === null || after === null) {
    return null;
  }
  return kind === 'duration'
    ? Number(after) - Number(before)
    : clockToMinutes(String(after)) - clockToMinutes(String(before));
}

function addMinutes(time: string, minutes: number): string | null {
  const total = clockToMinutes(time) + minutes;
  if (total < 0 || total >= 24 * 60) {
    return null;
  }
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(
    total % 60,
  ).padStart(2, '0')}`;
}

function clockToMinutes(value: string): number {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
}
