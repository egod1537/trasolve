import { Component } from 'react';
import { tripMapApi } from '../api/trips';
import { TripMapsWorkspace } from '../components/map/TripMapsWorkspace';
import { TripMapController } from '../controllers/TripMapController';
import type { TripMapContextValue } from '../hooks/map/useTripMap';
import { createTripMapStore } from '../stores/createTripMapStore';
import { TripMapProvider } from '../stores/TripMapProvider';

export default class MapPage extends Component {
  public constructor(props: Record<string, never>) {
    super(props);
    const store = createTripMapStore();
    this.application = {
      store,
      controller: new TripMapController(store, tripMapApi),
    };
  }

  public componentWillUnmount(): void {
    // Cancellation is idempotent and permits StrictMode to mount this instance again.
    this.application.controller.cancelPending();
  }

  public render() {
    return (
      <TripMapProvider value={this.application}>
        <TripMapsWorkspace />
      </TripMapProvider>
    );
  }

  private readonly application: TripMapContextValue;
}
