import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';
import type { Trip, TripPolylineMode } from '@trasolve/shared';
import {
  createPolylineRouteQuery,
  selectRouteCandidate,
  type RouteSegmentDetail,
  type RouteSegmentEndpoint,
  type RouteSegmentQuery,
  type RouteSegmentState,
} from '@/features/map-workspace/domain/routeSegment';
import type {
  RouteSegmentSnapshot,
  RouteSegmentStore,
} from '@/features/map-workspace/store/RouteSegmentStore';
import type { GeoPoint } from '@/shared/types/mapTypes';

export const RouteSegmentContext = createContext<RouteSegmentStore | null>(
  null,
);

export function useRouteSegmentStore(): RouteSegmentStore {
  const store = useContext(RouteSegmentContext);
  if (!store) {
    throw new Error('RouteSegmentContext is required.');
  }
  return store;
}

export function useRouteSegmentSnapshot(): RouteSegmentSnapshot {
  const store = useRouteSegmentStore();
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
}

export type RouteSegmentView = {
  state: RouteSegmentState;
  selectedIndex: number;
  /** Selected candidate when ready, otherwise null. */
  selected: RouteSegmentDetail | null;
};

/** Reads one cached route and requests it when it has not been computed yet. */
export function useRouteSegment(
  query: RouteSegmentQuery | null,
): RouteSegmentView | null {
  const store = useRouteSegmentStore();
  const key = query?.key ?? null;
  // Select stable members separately so unrelated updates do not re-render.
  const state = useSyncExternalStore(
    store.subscribe,
    () => (key === null ? undefined : store.getSnapshot().states.get(key)),
    () => (key === null ? undefined : store.getSnapshot().states.get(key)),
  );
  const selectedIndex = useSyncExternalStore(
    store.subscribe,
    () => (key === null ? 0 : (store.getSnapshot().selections.get(key) ?? 0)),
    () => (key === null ? 0 : (store.getSnapshot().selections.get(key) ?? 0)),
  );

  useEffect(() => {
    if (query) {
      store.ensure(query);
    }
  }, [query, store]);

  if (!query) {
    return null;
  }
  const resolved: RouteSegmentState = state ?? { status: 'loading' };
  return {
    state: resolved,
    selectedIndex,
    selected: selectRouteCandidate(resolved, selectedIndex),
  };
}

export function usePolylineRouteQuery(
  from: RouteSegmentEndpoint | undefined,
  to: RouteSegmentEndpoint | undefined,
  mode: TripPolylineMode,
): RouteSegmentQuery | null {
  const fromPlaceId = from?.placeId;
  const fromLat = from?.location.lat;
  const fromLng = from?.location.lng;
  const toPlaceId = to?.placeId;
  const toLat = to?.location.lat;
  const toLng = to?.location.lng;
  return useMemo(() => {
    if (
      fromLat === undefined ||
      fromLng === undefined ||
      toLat === undefined ||
      toLng === undefined
    ) {
      return null;
    }
    return createPolylineRouteQuery(
      { placeId: fromPlaceId, location: { lat: fromLat, lng: fromLng } },
      { placeId: toPlaceId, location: { lat: toLat, lng: toLng } },
      mode,
    );
  }, [fromLat, fromLng, fromPlaceId, mode, toLat, toLng, toPlaceId]);
}

function collectPolylineRouteQueries(
  trip: Trip,
): Array<{ polylineId: string; query: RouteSegmentQuery }> {
  return trip.days.flatMap((day) => {
    const places = new Map(day.places.map((place) => [place.id, place]));
    return day.polylines.flatMap((polyline) => {
      const from = places.get(polyline.fromPlaceId);
      const to = places.get(polyline.toPlaceId);
      const query =
        from && to ? createPolylineRouteQuery(from, to, polyline.mode) : null;
      return query ? [{ polylineId: polyline.id, query }] : [];
    });
  });
}

/**
 * Requests every non-straight segment of the Trip and resolves the computed
 * paths by polyline ID. Missing entries fall back to stored/straight geometry.
 */
export function useTripRoutePaths(
  trip: Trip,
): ReadonlyMap<string, readonly GeoPoint[]> {
  const store = useRouteSegmentStore();
  const snapshot = useRouteSegmentSnapshot();
  const queries = useMemo(() => collectPolylineRouteQueries(trip), [trip]);

  useEffect(() => {
    for (const { query } of queries) {
      store.ensure(query);
    }
  }, [queries, store]);

  return useMemo(() => {
    const paths = new Map<string, readonly GeoPoint[]>();
    for (const { polylineId, query } of queries) {
      const candidate = selectRouteCandidate(
        snapshot.states.get(query.key),
        snapshot.selections.get(query.key),
      );
      if (candidate) {
        paths.set(polylineId, candidate.path);
      }
    }
    return paths;
  }, [queries, snapshot]);
}
