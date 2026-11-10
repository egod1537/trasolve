import { useEffect, useState } from 'react';
import { TravelMode, type RouteLocation } from '@trasolve/shared';
import type {
  QueryRouteDetails,
  RouteEndpoint,
  RoutableMode,
} from '../domain/routeDetails';
import { toRouteQueryFailure, type RouteQueryState } from './routeQueryState';

export const ROUTE_MODES = [
  'straight',
  'walking',
  'transit',
  'driving',
] as const;
const ROUTABLE_MODES = ['walking', 'transit', 'driving'] as const;
export const TRAVEL_MODES = {
  walking: TravelMode.WALKING,
  transit: TravelMode.TRANSIT,
  driving: TravelMode.DRIVING,
} as const;
type States = Record<RoutableMode, RouteQueryState>;
const INITIAL: States = {
  walking: { status: 'loading' },
  transit: { status: 'loading' },
  driving: { status: 'loading' },
};

function toLocation(lat: number, lng: number): RouteLocation {
  return { type: 'coordinates', lat, lng };
}

export function useRouteOptions(
  from: RouteEndpoint,
  to: RouteEndpoint,
  language: string,
  query: QueryRouteDetails,
) {
  const {
    placeId: fromId,
    location: { lat: fromLat, lng: fromLng },
  } = from;
  const {
    placeId: toId,
    location: { lat: toLat, lng: toLng },
  } = to;
  const key = JSON.stringify([
    fromId,
    fromLat,
    fromLng,
    toId,
    toLat,
    toLng,
    language,
  ]);
  const [snapshot, setSnapshot] = useState<{
    key: string;
    states: States;
  } | null>(null);
  useEffect(() => {
    const request = new AbortController();
    const origin = toLocation(fromLat, fromLng);
    const destination = toLocation(toLat, toLng);
    const publish = (mode: RoutableMode, state: RouteQueryState) => {
      if (!request.signal.aborted) {
        setSnapshot((current) => ({
          key,
          states: {
            ...(current?.key === key ? current.states : INITIAL),
            [mode]: state,
          },
        }));
      }
    };
    void Promise.allSettled(
      ROUTABLE_MODES.map(async (mode) => {
        try {
          const routes = await query(
            { origin, destination, travelMode: TRAVEL_MODES[mode] },
            request.signal,
          );
          publish(
            mode,
            routes.length
              ? { status: 'ready', routes }
              : {
                  status: 'error',
                  failure: {
                    kind: 'not-found',
                    code: 'ROUTE_NOT_FOUND',
                    httpStatus: null,
                  },
                },
          );
        } catch (error) {
          publish(mode, {
            status: 'error',
            failure: toRouteQueryFailure(error),
          });
        }
      }),
    );
    return () => request.abort();
  }, [fromId, fromLat, fromLng, toId, toLat, toLng, language, key, query]);
  const states = snapshot?.key === key ? snapshot.states : INITIAL;
  return {
    states,
    key,
    settled: ROUTABLE_MODES.every((mode) => states[mode].status !== 'loading'),
  };
}
