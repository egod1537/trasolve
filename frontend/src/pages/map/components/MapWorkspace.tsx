import { useMemo, useRef, useState } from 'react';
import { useTripEditController, useTripState } from '../hooks/useTrip';
import { tripToView } from '../domain/tripMapping';
import { useMapUi } from '../hooks/useMapUi';
import { LayerPanel } from './layer-panel/LayerPanel';
import { MapViewport } from './viewport/MapViewport';
import { MapAiRegion } from './ai/MapAiRegion';
import '../styles/map.css';

export function MapWorkspace() {
  const { trip, routes, status } = useTripState();
  const controller = useTripEditController();
  const view = useMemo(() => tripToView(trip), [trip]);
  const ui = useMapUi(trip);
  const [aiOpen, setAiOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  return (
    <div className="trip-map-workspace">
      <main className="trip-map-page">
        <LayerPanel
          busy={status === 'saving'}
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
          trip={trip}
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
