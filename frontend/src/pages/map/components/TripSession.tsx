import { useEffect, useState } from 'react';
import type { Trip } from '@trasolve/shared';
import { TripEditController } from '../controller/TripEditController';
import type { TripRepository } from '../repository/TripRepository';
import { createTripStore } from '../store/createTripStore';
import { TripProvider } from '../store/TripProvider';
import { MapWorkspace } from './MapWorkspace';

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
      <MapWorkspace />
    </TripProvider>
  );
}
