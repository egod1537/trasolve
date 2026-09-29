import { useEffect, useState } from 'react';
import {
  analyticsScreenSchema,
  analyticsTargetSchema,
  type AnalyticsOverviewResponse,
} from '@trasolve/shared';

type TargetMetric = AnalyticsOverviewResponse['targets'][number];
type TargetMetricDetails = Omit<TargetMetric, 'screen' | 'target'>;

type TargetMarker = {
  key: string;
  screen: TargetMetric['screen'] | null;
  target: TargetMetric['target'];
  metrics: TargetMetricDetails;
  top: number;
  left: number;
};

export function AnalyticsTargetAnnotations({
  targets,
}: {
  targets: readonly TargetMetric[];
}) {
  const [markers, setMarkers] = useState<readonly TargetMarker[]>([]);
  const [selectedMarkerKey, setSelectedMarkerKey] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let elements: readonly HTMLElement[] = [];
    let animationFrame = 0;
    const exactMetrics = new Map(
      targets.map((metric) => [
        createMetricKey(metric.screen, metric.target),
        metric,
      ]),
    );
    const unambiguousTargetMetrics = createUnambiguousTargetMetrics(targets);

    const updatePositions = (): void => {
      animationFrame = 0;
      const occurrenceCounts = new Map<string, number>();
      const nextMarkers: TargetMarker[] = [];
      for (const element of elements) {
        const targetResult = analyticsTargetSchema.safeParse(
          element.dataset.analyticsId,
        );
        if (!targetResult.success || !isVisible(element)) {
          continue;
        }
        const target = targetResult.data;
        const screenValue = element.dataset.analyticsScreen;
        const screenResult =
          screenValue === undefined
            ? null
            : analyticsScreenSchema.safeParse(screenValue);
        if (screenResult !== null && !screenResult.success) {
          continue;
        }
        const screen = screenResult?.data ?? null;
        const metric =
          screen === null
            ? unambiguousTargetMetrics.get(target)
            : exactMetrics.get(createMetricKey(screen, target));
        const identity = `${screen ?? '*'}\u0000${target}`;
        const occurrence = occurrenceCounts.get(identity) ?? 0;
        occurrenceCounts.set(identity, occurrence + 1);
        const bounds = element.getBoundingClientRect();
        nextMarkers.push({
          key: `${identity}\u0000${occurrence}`,
          screen,
          target,
          metrics: metric ? toMetricDetails(metric) : emptyMetricDetails,
          top: bounds.top,
          left: bounds.right,
        });
      }
      setMarkers((current) =>
        markersEqual(current, nextMarkers) ? current : nextMarkers,
      );
    };

    const schedulePositionUpdate = (): void => {
      if (animationFrame === 0) {
        animationFrame = requestAnimationFrame(updatePositions);
      }
    };

    const elementResizeObserver = new ResizeObserver(schedulePositionUpdate);
    const scanElements = (): void => {
      elementResizeObserver.disconnect();
      elements = [
        ...document.querySelectorAll<HTMLElement>('[data-analytics-id]'),
      ];
      for (const element of elements) {
        elementResizeObserver.observe(element);
      }
      schedulePositionUpdate();
    };

    const mutationObserver = new MutationObserver(scanElements);
    mutationObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        'data-analytics-id',
        'data-analytics-screen',
        'class',
        'style',
        'hidden',
        'aria-hidden',
      ],
    });
    window.addEventListener('resize', schedulePositionUpdate);
    document.addEventListener('scroll', schedulePositionUpdate, true);
    scanElements();

    return () => {
      if (animationFrame !== 0) {
        cancelAnimationFrame(animationFrame);
      }
      mutationObserver.disconnect();
      elementResizeObserver.disconnect();
      window.removeEventListener('resize', schedulePositionUpdate);
      document.removeEventListener('scroll', schedulePositionUpdate, true);
    };
  }, [targets]);

  useEffect(() => {
    if (selectedMarkerKey === null) {
      return;
    }
    const handleOutsidePointer = (event: PointerEvent): void => {
      if (
        event.target instanceof Element &&
        event.target.closest('[data-analytics-annotation]')
      ) {
        return;
      }
      setSelectedMarkerKey(null);
    };
    document.addEventListener('pointerdown', handleOutsidePointer, true);
    return () =>
      document.removeEventListener('pointerdown', handleOutsidePointer, true);
  }, [selectedMarkerKey]);

  const selectedMarker =
    markers.find(({ key }) => key === selectedMarkerKey) ?? null;

  return (
    <div className="analytics-target-annotations">
      {markers.map((marker) => (
        <button
          key={marker.key}
          type="button"
          className="analytics-target-marker"
          data-analytics-annotation="badge"
          data-analytics-target={marker.target}
          data-analytics-screen={marker.screen ?? undefined}
          style={{ top: marker.top, left: marker.left }}
          aria-label={`${marker.target}: ${marker.metrics.events}`}
          aria-expanded={selectedMarkerKey === marker.key}
          aria-controls="analytics-target-popover"
          onClick={() =>
            setSelectedMarkerKey((current) =>
              current === marker.key ? null : marker.key,
            )
          }
        >
          {marker.metrics.events}
        </button>
      ))}
      {selectedMarker ? <TargetPopover marker={selectedMarker} /> : null}
    </div>
  );
}

function TargetPopover({ marker }: { marker: TargetMarker }) {
  const top =
    marker.top + 340 < window.innerHeight
      ? marker.top + 20
      : Math.max(8, marker.top - 330);
  const left = Math.min(
    Math.max(8, marker.left - 300),
    Math.max(8, window.innerWidth - 316),
  );
  const summary = {
    events: marker.metrics.events,
    sessions: marker.metrics.sessions,
    convertedSessions: marker.metrics.convertedSessions,
    conversionRate: marker.metrics.conversionRate,
    dropOffSessions: marker.metrics.dropOffSessions,
    dropOffRate: marker.metrics.dropOffRate,
    backtrackCount: marker.metrics.backtrackCount,
    backtrackSessions: marker.metrics.backtrackSessions,
  };

  return (
    <aside
      id="analytics-target-popover"
      className="analytics-target-popover"
      data-analytics-annotation="popover"
      aria-label={marker.target}
      style={{ top, left }}
    >
      <header>
        <code>{marker.screen ?? '*'}</code>
        <code>{marker.target}</code>
      </header>
      <dl>
        {Object.entries(summary).map(([identifier, value]) => (
          <div key={identifier}>
            <dt>
              <code>{identifier}</code>
            </dt>
            <dd>{formatPopoverMetric(identifier, value)}</dd>
          </div>
        ))}
      </dl>
      <ol>
        {marker.metrics.nextTransitions.map((transition) => (
          <li key={transition.target}>
            <code>{transition.target}</code>
            <span>{transition.events}</span>
            <span>{formatRate(transition.ratio)}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}

function createUnambiguousTargetMetrics(
  targets: readonly TargetMetric[],
): ReadonlyMap<TargetMetric['target'], TargetMetric> {
  const metrics = new Map<TargetMetric['target'], TargetMetric | null>();
  for (const metric of targets) {
    if (metrics.has(metric.target)) {
      metrics.set(metric.target, null);
    } else {
      metrics.set(metric.target, metric);
    }
  }
  return new Map(
    [...metrics]
      .filter((entry): entry is [TargetMetric['target'], TargetMetric] =>
        Boolean(entry[1]),
      )
      .map(([target, metric]) => [target, metric]),
  );
}

const emptyMetricDetails: TargetMetricDetails = {
  events: 0,
  sessions: 0,
  convertedSessions: 0,
  conversionRate: 0,
  dropOffSessions: 0,
  dropOffRate: 0,
  backtrackCount: 0,
  backtrackSessions: 0,
  nextTransitions: [],
};

function toMetricDetails(metric: TargetMetric): TargetMetricDetails {
  return {
    events: metric.events,
    sessions: metric.sessions,
    convertedSessions: metric.convertedSessions,
    conversionRate: metric.conversionRate,
    dropOffSessions: metric.dropOffSessions,
    dropOffRate: metric.dropOffRate,
    backtrackCount: metric.backtrackCount,
    backtrackSessions: metric.backtrackSessions,
    nextTransitions: metric.nextTransitions,
  };
}

function createMetricKey(screen: string, target: string): string {
  return `${screen}\u0000${target}`;
}

function isVisible(element: HTMLElement): boolean {
  const bounds = element.getBoundingClientRect();
  const styles = getComputedStyle(element);
  return (
    bounds.width > 0 &&
    bounds.height > 0 &&
    styles.display !== 'none' &&
    styles.visibility !== 'hidden'
  );
}

function markersEqual(
  left: readonly TargetMarker[],
  right: readonly TargetMarker[],
): boolean {
  return (
    left.length === right.length &&
    left.every((marker, index) => {
      const other = right[index];
      return (
        marker.key === other.key &&
        marker.screen === other.screen &&
        marker.target === other.target &&
        metricDetailsEqual(marker.metrics, other.metrics) &&
        marker.top === other.top &&
        marker.left === other.left
      );
    })
  );
}

function metricDetailsEqual(
  left: TargetMetricDetails,
  right: TargetMetricDetails,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function formatPopoverMetric(identifier: string, value: number): string {
  return identifier.endsWith('Rate') ? formatRate(value) : String(value);
}

function formatRate(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value);
}
