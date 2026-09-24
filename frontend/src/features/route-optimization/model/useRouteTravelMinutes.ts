import {
  TravelMode,
  type TripPlace,
  type TrouteTravelMode,
} from '@trasolve/shared';
import { useEffect, useRef, useState } from 'react';
import { getDirections } from '@/shared/api/routes';

const MAX_ROUTED_SEGMENTS = 20;
const DIRECTIONS_MODE_BY_TROUTE_MODE = {
  TRANSIT: TravelMode.TRANSIT,
  DRIVING: TravelMode.DRIVING,
  WALKING: TravelMode.WALKING,
  BICYCLING: TravelMode.BICYCLING,
} as const satisfies Record<TrouteTravelMode, TravelMode>;

type TravelMinutesState = {
  key: string;
  value: number | null;
};

export function useRouteTravelMinutes(
  places: readonly TripPlace[],
  travelMode: TrouteTravelMode,
): number | null {
  const key = `${travelMode}::${places
    .map((place) => `${place.id}:${place.location.lat}:${place.location.lng}`)
    .join('|')}`;
  const cache = useRef(new Map<string, number | null>());
  const [state, setState] = useState<TravelMinutesState>({ key, value: null });

  useEffect(() => {
    if (cache.current.has(key)) {
      setState({ key, value: cache.current.get(key) ?? null });
      return;
    }
    if (places.length < 2 || places.length - 1 > MAX_ROUTED_SEGMENTS) {
      cache.current.set(key, null);
      setState({ key, value: null });
      return;
    }

    const controller = new AbortController();
    setState({ key, value: null });
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
        const durationMillis = routes.reduce<number | null>(
          (total, route) =>
            total === null ||
            !route ||
            route.durationMillis === null ||
            route.durationMillis === undefined
              ? null
              : total + route.durationMillis,
          0,
        );
        const value =
          durationMillis === null ? null : Math.round(durationMillis / 60_000);
        cache.current.set(key, value);
        setState({ key, value });
      },
      () => {
        if (controller.signal.aborted) {
          return;
        }
        cache.current.set(key, null);
        setState({ key, value: null });
      },
    );
    return () => controller.abort();
  }, [key, places, travelMode]);

  return state.key === key ? state.value : null;
}
