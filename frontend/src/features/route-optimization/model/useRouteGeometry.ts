import {
  TravelMode,
  type TripPlace,
  type TrouteTravelMode,
} from '@trasolve/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getDirections } from '@/shared/api/routes';
import type { GeoPoint } from '@/shared/types/mapTypes';

const MAX_ROUTED_SEGMENTS = 20;
const DIRECTIONS_MODE_BY_TROUTE_MODE = {
  TRANSIT: TravelMode.TRANSIT,
  DRIVING: TravelMode.DRIVING,
  WALKING: TravelMode.WALKING,
  BICYCLING: TravelMode.BICYCLING,
} as const satisfies Record<TrouteTravelMode, TravelMode>;

export type RouteGeometryState = {
  key: string;
  status: 'idle' | 'loading' | 'ready' | 'fallback';
  path: readonly GeoPoint[];
  travelMinutes: number | null;
};

export function useRouteGeometry(
  places: readonly TripPlace[],
  travelMode: TrouteTravelMode,
  preferredPath?: readonly GeoPoint[],
): RouteGeometryState {
  const key = `${travelMode}::${places
    .map((place) => `${place.id}:${place.location.lat}:${place.location.lng}`)
    .join('|')}::${preferredPath
    ?.map((point) => `${point.lat}:${point.lng}`)
    .join('|')}`;
  const fallbackPath = useMemo(
    () => places.map((place) => place.location),
    [places],
  );
  const cache = useRef(new Map<string, RouteGeometryState>());
  const displayPath = preferredPath?.length ? preferredPath : fallbackPath;
  const [state, setState] = useState<RouteGeometryState>({
    key,
    status: 'idle',
    path: displayPath,
    travelMinutes: null,
  });

  useEffect(() => {
    const cached = cache.current.get(key);
    if (cached) {
      setState(cached);
      return;
    }
    if (places.length < 2 || places.length - 1 > MAX_ROUTED_SEGMENTS) {
      const fallback: RouteGeometryState = {
        key,
        status: preferredPath?.length ? 'ready' : 'fallback',
        path: displayPath,
        travelMinutes: null,
      };
      cache.current.set(key, fallback);
      setState(fallback);
      return;
    }

    const controller = new AbortController();
    setState({
      key,
      status: 'loading',
      path: displayPath,
      travelMinutes: null,
    });
    const requests = places.slice(0, -1).map((place, index) =>
      getDirections(
        {
          origin: {
            type: 'coordinates',
            lat: place.location.lat,
            lng: place.location.lng,
          },
          destination: {
            type: 'coordinates',
            lat: places[index + 1]!.location.lat,
            lng: places[index + 1]!.location.lng,
          },
          travelMode: DIRECTIONS_MODE_BY_TROUTE_MODE[travelMode],
        },
        controller.signal,
      ),
    );
    void Promise.all(requests).then(
      (results) => {
        if (controller.signal.aborted) {
          return;
        }
        const routes = results.map((result) => result.routes[0]);
        if (routes.some((route) => !route || route.path.length < 2)) {
          throw new Error('실제 경로 geometry가 없습니다.');
        }
        const next: RouteGeometryState = {
          key,
          status: 'ready',
          path: preferredPath?.length
            ? preferredPath
            : routes.flatMap((route, index) =>
                index === 0 ? route!.path : route!.path.slice(1),
              ),
          travelMinutes: Math.round(
            routes.reduce(
              (total, route) => total + (route!.durationMillis ?? 0),
              0,
            ) / 60_000,
          ),
        };
        cache.current.set(key, next);
        setState(next);
      },
      () => {
        if (controller.signal.aborted) {
          return;
        }
        const fallback: RouteGeometryState = {
          key,
          status: preferredPath?.length ? 'ready' : 'fallback',
          path: displayPath,
          travelMinutes: null,
        };
        cache.current.set(key, fallback);
        setState(fallback);
      },
    );
    return () => controller.abort();
  }, [displayPath, key, places, preferredPath, travelMode]);

  return state.key === key
    ? state
    : {
        key,
        status: 'loading',
        path: displayPath,
        travelMinutes: null,
      };
}
