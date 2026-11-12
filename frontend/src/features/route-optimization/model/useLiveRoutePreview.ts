import { useEffect, useRef, useState } from 'react';
import type { TripDay, TrouteOptimizeResponse } from '@trasolve/shared';
import type { Props } from './optimizationModalTypes';
import type { RouteComparisonData } from './routeComparison';
import { RoutePreviewPlayback } from './RoutePreviewPlayback';
import { createRouteSearchIllustrator } from './createRouteSearchIllustrator';
import {
  createRouteOptimizationSchedule,
  createTripScheduleUpdate,
  getBestOptimizationCandidate,
  isApplicableCandidate,
  type RouteOptimizationRequestOptions,
} from './routeOptimization';

type Session = {
  day: TripDay;
  options: RouteOptimizationRequestOptions;
  cancel: () => void;
  playback: RoutePreviewPlayback;
};

/** Bounded playback is owned by this UI session, never by the solver. */
export function useLiveRoutePreview(onCompare: Props['onCompare']) {
  const [data, setData] = useState<RouteComparisonData | null>(null);
  const session = useRef<Session | null>(null);
  useEffect(() => {
    if (data) {
      onCompare(data);
    }
  }, [data, onCompare]);
  useEffect(
    () => () => {
      session.current?.playback.stop();
      session.current = null;
    },
    [],
  );
  const stop = () => {
    session.current?.playback.stop();
    session.current = null;
    setData(null);
  };
  const end = (
    status: 'cancelling' | 'failed' | 'cancelled',
    actions?: { onRetry: () => void; onClose: () => void },
  ) => {
    session.current?.playback.stop();
    session.current = null;
    setData((current) =>
      current?.live
        ? {
            ...current,
            live: {
              ...current.live,
              hasResult: false,
              illustrative: false,
              status,
              ...actions,
            },
          }
        : current,
    );
  };
  const start = (
    day: TripDay,
    options: RouteOptimizationRequestOptions,
    cancel: () => void,
  ) => {
    session.current?.playback.stop();
    session.current = {
      day,
      options,
      cancel,
      playback: new RoutePreviewPlayback(
        setData,
        createRouteSearchIllustrator(day, options, cancel),
      ),
    };
    const ordered = [...day.places].sort((a, b) => a.order - b.order);
    setData({
      day,
      fingerprint: JSON.stringify(day),
      travelMode: options.travelMode,
      update: {
        placeIds: ordered.map((place) => place.id),
        stops: [],
        expectedStartPlaceId: options.selectedStartPlaceId,
        expectedEndPlaceId: options.selectedEndPlaceId,
      },
      live: { hasResult: false, revision: 0, onCancel: cancel },
    });
  };
  const receive = (revision: number, result: TrouteOptimizeResponse) => {
    const current = session.current;
    if (!current) {
      return;
    }
    const candidate = getBestOptimizationCandidate(result);
    const schedule = createRouteOptimizationSchedule(
      result,
      candidate,
      current.day,
    );
    if (
      !schedule ||
      !isApplicableCandidate(candidate, current.day, current.options)
    ) {
      return;
    }
    current.playback.receive({
      day: current.day,
      fingerprint: JSON.stringify(current.day),
      travelMode: current.options.travelMode,
      update: createTripScheduleUpdate(
        schedule,
        current.options.selectedStartPlaceId,
        current.options.selectedEndPlaceId,
        result.skipped_locations?.map((item) => item.location_id) ?? [],
      ),
      live: { hasResult: true, revision, onCancel: current.cancel },
    });
  };
  const finish = (finalData: RouteComparisonData, signal: AbortSignal) =>
    session.current?.playback.finish(finalData, signal) ??
    Promise.reject(new DOMException('Playback stopped', 'AbortError'));
  return { start, receive, finish, stop, end };
}
