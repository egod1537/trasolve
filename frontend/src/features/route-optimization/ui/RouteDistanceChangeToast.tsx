import { useEffect, useRef, useState } from 'react';
import type { RouteComparisonData } from '../model/routeComparison';
import { getRouteDistanceChange } from '../model/routeComparisonMetrics';
import { getLanguage, useL } from '@/shared/i18n';

type Notice = { revision: number; savedMeters: number };

/** One replaceable notice above the controls, measured from the preceding visible route. */
export function RouteDistanceChangeToast({
  data,
}: {
  data: RouteComparisonData;
}) {
  const L = useL();
  const previous = useRef<RouteComparisonData | null>(null);
  const revision = useRef(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = data;
    if (
      !before ||
      before.day !== data.day ||
      data.live?.status === 'failed' ||
      data.live?.status === 'cancelled' ||
      data.live?.status === 'cancelling'
    ) {
      setNotice(null);
      return;
    }
    if (
      before.update.placeIds.length === data.update.placeIds.length &&
      before.update.placeIds.every(
        (id, index) => id === data.update.placeIds[index],
      )
    ) {
      return;
    }
    const savedMeters = getRouteDistanceChange(before, data);
    setNotice(
      savedMeters !== null && Math.abs(savedMeters) >= 1
        ? { revision: ++revision.current, savedMeters }
        : null,
    );
  }, [data]);
  useEffect(() => {
    if (!notice) {
      return;
    }
    const timer = setTimeout(() => setNotice(null), 2400);
    return () => clearTimeout(timer);
  }, [notice]);
  if (!notice) {
    return null;
  }
  const absolute = Math.abs(notice.savedMeters);
  const distance = new Intl.NumberFormat(getLanguage(), {
    style: 'unit',
    unit: absolute < 1000 ? 'meter' : 'kilometer',
    unitDisplay: 'short',
    maximumFractionDigits: absolute < 1000 ? 0 : 1,
  }).format(absolute < 1000 ? absolute : absolute / 1000);
  return (
    <aside
      key={notice.revision}
      className={`route-review-distance-toast${notice.savedMeters < 0 ? ' is-increase' : ''}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="route-review-distance-toast-icon" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d={
              notice.savedMeters > 0
                ? 'M12 4v16m-6-6 6 6 6-6'
                : 'M12 20V4m-6 6 6-6 6 6'
            }
          />
        </svg>
      </span>
      <div>
        <span>{L('routeOptimization:routeReviewSummary.distanceLabel')}</span>
        <strong>
          {notice.savedMeters > 0
            ? L('routeOptimization:routeReviewSummary.distanceSaved', {
                distance,
              })
            : L('routeOptimization:routeReviewSummary.distanceAdded', {
                distance,
              })}
        </strong>
      </div>
    </aside>
  );
}
