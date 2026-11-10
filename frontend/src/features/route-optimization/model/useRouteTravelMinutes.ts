import {
  TravelMode,
  getGoogleMapsLocale,
  type TripPlace,
  type TrouteTravelMode,
} from '@trasolve/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getDirections } from '@/shared/api/routes';
import { getLanguage } from '@/shared/i18n';

const MAX_INTERMEDIATES = 25;
const DIRECTIONS_MODE_BY_TROUTE_MODE = {
  TRANSIT: TravelMode.TRANSIT,
  DRIVING: TravelMode.DRIVING,
  WALKING: TravelMode.WALKING,
  BICYCLING: TravelMode.BICYCLING,
} as const satisfies Record<TrouteTravelMode, TravelMode>;

export type RouteDirections = {
  path: readonly { lat: number; lng: number }[];
  travelMinutes: number | null;
};

type RouteDirectionsState = {
  key: string;
  value: RouteDirections;
};

export function useRouteDirections(
  places: readonly TripPlace[],
  travelMode: TrouteTravelMode,
): RouteDirections {
  const { languageCode, regionCode } = getGoogleMapsLocale(getLanguage());
  const key = `${languageCode}:${regionCode}:${travelMode}::${places
    .map((place) => `${place.id}:${place.location.lat}:${place.location.lng}`)
    .join('|')}`;
  const fallbackPath = useMemo(
    () => places.map((place) => place.location),
    [places],
  );
  const cache = useRef(new Map<string, RouteDirections>());
  const [state, setState] = useState<RouteDirectionsState>({
    key,
    value: { path: fallbackPath, travelMinutes: null },
  });

  useEffect(() => {
    const cached = cache.current.get(key);
    if (cached) {
      setState({ key, value: cached });
      return;
    }

    const fallback = { path: fallbackPath, travelMinutes: null };
    if (places.length < 2 || places.length - 2 > MAX_INTERMEDIATES) {
      cache.current.set(key, fallback);
      setState({ key, value: fallback });
      return;
    }

    const controller = new AbortController();
    setState({ key, value: fallback });
    void getDirections(
      {
        origin: {
          type: 'coordinates',
          lat: places[0]!.location.lat,
          lng: places[0]!.location.lng,
        },
        destination: {
          type: 'coordinates',
          lat: places.at(-1)!.location.lat,
          lng: places.at(-1)!.location.lng,
        },
        intermediates: places.slice(1, -1).map((place) => ({
          type: 'coordinates' as const,
          lat: place.location.lat,
          lng: place.location.lng,
        })),
        travelMode: DIRECTIONS_MODE_BY_TROUTE_MODE[travelMode],
      },
      controller.signal,
    ).then(
      (result) => {
        if (controller.signal.aborted) {
          return;
        }
        const route = result.routes[0];
        const value: RouteDirections = {
          path: route?.path.length ? route.path : fallbackPath,
          travelMinutes:
            route?.durationMillis === null ||
            route?.durationMillis === undefined
              ? null
              : Math.round(route.durationMillis / 60_000),
        };
        cache.current.set(key, value);
        setState({ key, value });
      },
      () => {
        if (controller.signal.aborted) {
          return;
        }
        cache.current.set(key, fallback);
        setState({ key, value: fallback });
      },
    );
    return () => controller.abort();
  }, [fallbackPath, key, places, travelMode]);

  return state.key === key
    ? state.value
    : { path: fallbackPath, travelMinutes: null };
}

export function useRouteTravelMinutes(
  places: readonly TripPlace[],
  travelMode: TrouteTravelMode,
): number | null {
  return useRouteDirections(places, travelMode).travelMinutes;
}
