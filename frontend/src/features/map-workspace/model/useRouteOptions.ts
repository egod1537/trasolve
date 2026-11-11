import { useEffect, useMemo, useRef, useState } from 'react';
import {
  TravelMode,
  type RouteLocation,
  type TripPolylineMode,
} from '@trasolve/shared';
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
export const TRAVEL_MODES = {
  walking: TravelMode.WALKING,
  transit: TravelMode.TRANSIT,
  driving: TravelMode.DRIVING,
} as const;
type States = Record<RoutableMode, RouteQueryState>;
const INITIAL: States = {
  walking: { status: 'idle' },
  transit: { status: 'idle' },
  driving: { status: 'idle' },
};
type QueryContext = { key: string; query: QueryRouteDetails };
type Snapshot = { context: QueryContext; states: States };
type Session = { request: AbortController; snapshot: Snapshot };

function toLocation(lat: number, lng: number): RouteLocation {
  return { type: 'coordinates', lat, lng };
}

function routeOptionsKey(
  from: RouteEndpoint,
  to: RouteEndpoint,
  language: string,
) {
  return JSON.stringify([
    from.placeId,
    from.location,
    to.placeId,
    to.location,
    language,
  ]);
}

export function useRouteOptions(
  from: RouteEndpoint,
  to: RouteEndpoint,
  language: string,
  query: QueryRouteDetails,
  mode: TripPolylineMode,
) {
  const { lat: fromLat, lng: fromLng } = from.location;
  const { lat: toLat, lng: toLng } = to.location;
  const key = routeOptionsKey(from, to, language);
  const context = useMemo(() => ({ key, query }), [key, query]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const sessionRef = useRef<Session | null>(null);
  useEffect(() => {
    const session = {
      request: new AbortController(),
      snapshot: { context, states: INITIAL },
    };
    sessionRef.current = session;
    // Switching tabs keeps requests alive; changing the query or closing cancels them.
    return () => session.request.abort();
  }, [context]);
  useEffect(() => {
    const session = sessionRef.current;
    if (
      !session ||
      mode === 'straight' ||
      session.snapshot.states[mode].status !== 'idle'
    ) {
      return;
    }
    const { signal } = session.request;
    const origin = toLocation(fromLat, fromLng);
    const destination = toLocation(toLat, toLng);
    const publish = (state: RouteQueryState) => {
      if (!signal.aborted) {
        session.snapshot = {
          ...session.snapshot,
          states: { ...session.snapshot.states, [mode]: state },
        };
        setSnapshot(session.snapshot);
      }
    };
    publish({ status: 'loading' });
    void query(
      { origin, destination, travelMode: TRAVEL_MODES[mode] },
      signal,
    ).then(
      (routes) =>
        publish(
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
        ),
      (error: unknown) =>
        publish({ status: 'error', failure: toRouteQueryFailure(error) }),
    );
  }, [fromLat, fromLng, toLat, toLng, context, query, mode]);
  const states = snapshot?.context === context ? snapshot.states : INITIAL;
  return { states, key };
}
