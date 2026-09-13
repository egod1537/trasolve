import { useEffect, useState } from 'react';
import type { Trip } from '@trasolve/shared';
import { getDirections } from '../../../api/routes';
import { TripEditController } from '../controller/TripEditController';
import type { QueryRouteDuration } from '../domain/routeDuration';
import type { TripRepository } from '../repository/TripRepository';
import { createTripStore } from '../store/createTripStore';
import { TripProvider } from '../store/TripProvider';
import { MapWorkspace } from './MapWorkspace';

const queryRouteDuration: QueryRouteDuration = async (request, signal) => {
  const result = await getDirections(request, signal);
  return result.routes[0]?.durationMillis ?? null;
};

/** The workspace keys this component by Trip ID; each mount owns one session. */
export function TripSession({
  trip,
  repository,
}: {
  trip: Trip;
  repository: TripRepository;
}) {
  const [application] = useState(() => {
    const store = createTripStore(trip);
    return { store, controller: new TripEditController(store, repository) };
  });

  useEffect(() => () => application.controller.cancelPending(), [application]);

  return (
    <TripProvider value={application}>
      <MapWorkspace onQueryRouteDuration={queryRouteDuration} />
    </TripProvider>
  );
}
