import { useMemo, useRef, useState } from 'react';
import type { TripMap } from '@trasolve/shared';
import {
  useTripMapController,
  useTripMapState,
} from '../hooks/useTripMap';
import { tripMapToView } from '../domain/tripMapMapping';
import { useMapUi } from '../hooks/useMapUi';
import { LayerPanel } from './layer-panel/LayerPanel';
import { MapViewport } from './viewport/MapViewport';
import { MapAiRegion } from './ai/MapAiRegion';
import '../styles/map.css';

export function MapWorkspace({ trip }: { trip: TripMap }) {
  const { routes, status } = useTripMapState();
  const controller = useTripMapController();
  const view = useMemo(() => tripMapToView(trip), [trip]);
  const ui = useMapUi(trip);
  const [aiOpen, setAiOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  return (
    <div className="trip-map-workspace">
      <main className="trip-map-page">
        <LayerPanel
          busy={status === 'loading' || status === 'saving'}
          selectionRevision={ui.selectionRevision}
          trip={view}
          sidebarRef={sidebarRef}
          selectedPlaceId={ui.selectedPlaceId}
          selectedDayId={ui.selectedDayId}
          onSelectPlace={ui.selectPlace}
          onSelectDay={ui.selectDay}
          onShowAll={ui.showAll}
          onMovePlace={(dayId, placeId, targetIndex) =>
            void controller.movePlace(placeId, dayId, targetIndex)
          }
        />
        <MapViewport
          tripMap={trip}
          routes={routes}
          focusTarget={ui.focusTarget}
          selectedPlaceId={ui.selectedPlaceId}
          selectedDayId={ui.selectedDayId}
          onSelectPlace={ui.selectPlace}
          sidebarRef={sidebarRef}
          aiOpen={aiOpen}
        />
        <MapAiRegion open={aiOpen} onOpenChange={setAiOpen} />
      </main>
    </div>
  );
}
