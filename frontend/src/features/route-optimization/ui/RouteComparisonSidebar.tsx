import { useLayoutMaxWidth } from '@/shared/hooks/useLayoutMaxWidth';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import { useMemo, type RefObject } from 'react';
import { PlaceTimeTimeline } from '@/features/place-editor';
import {
  getComparisonPlaces,
  type RouteComparisonView,
} from '@/features/route-optimization/model/routeComparison';
import { useL } from '@/shared/i18n';
import { getRouteComparisonStyle } from './routeComparisonStyle';
import { RouteComparisonSummary } from './RouteComparisonSummary';
import '@/features/route-optimization/ui/route-optimization.css';

type Props = {
  comparison: RouteComparisonView;
  sidebarRef: RefObject<HTMLElement | null>;
};

export function RouteComparisonSidebar({ comparison, sidebarRef }: Props) {
  const L = useL();
  const mobile = useLayoutMaxWidth();
  const places = useMemo(
    () => getComparisonPlaces(comparison.data, comparison.mode),
    [comparison.data, comparison.mode],
  );
  if (mobile) {
    return null;
  }
  return (
    <aside
      ref={sidebarRef}
      className="route-review-sidebar"
      style={getRouteComparisonStyle(comparison.mode)}
      aria-label={L(
        'routeOptimization:routeOptimizationModal.title.pathComparison',
      )}
    >
      <header>
        <RouteComparisonSummary data={comparison.data} />
      </header>
      <div className="route-review-day-heading">
        <div>
          <h2>{comparison.data.day.title}</h2>
          <span>
            {L('map:bottomContextPanel.text.locations', {
              length: places.length,
            })}
          </span>
        </div>
        <span className="route-review-mode-badge">
          {comparison.mode === 'current'
            ? L(
                'routeOptimization:routeSchedulePreview.beforeSchedule.text.currentSchedule',
              )
            : L(
                'routeOptimization:routeSchedulePreview.afterSchedule.text.optimizationSchedule',
              )}
        </span>
      </div>
      <ScrollArea className="route-review-place-list-scroll" contentAsChild>
        <ol className="route-review-place-list">
          {places.map((place, index) => (
            <li
              key={`${place.id}:${index}:${place.time ?? ''}`}
              className={
                comparison.data.live?.hasResult ||
                comparison.data.live?.illustrative
                  ? 'is-updated'
                  : undefined
              }
            >
              <div className="route-review-place-heading">
                <span className="route-review-place-number">{index + 1}</span>
                <strong>{place.name}</strong>
              </div>
              <div className="route-review-place-timeline">
                <PlaceTimeTimeline
                  variant="compact"
                  time={place.time}
                  visitDurationMinutes={
                    place.preferredDurationMinutes ?? place.visitDurationMinutes
                  }
                  readOnly
                />
              </div>
            </li>
          ))}
        </ol>
      </ScrollArea>
    </aside>
  );
}
