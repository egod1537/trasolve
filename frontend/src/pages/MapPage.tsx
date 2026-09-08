import { useEffect, useRef, useState } from 'react';
import { GoogleMapView } from '../components/map/GoogleMapView';
import { MapAiButton } from '../components/map/MapAiButton';
import { MapAiPanel } from '../components/map/MapAiPanel';
import { MapSearchBar } from '../components/map/MapSearchBar';
import { TripSidebar } from '../components/map/TripSidebar';
import { demoTrip } from '../data/demoTrip';
import { MapModel } from '../domain/map/MapModel';
import { useMapModel } from '../hooks/useMapModel';
import '../styles/map.css';

export default function MapPage() {
  const [model] = useState(() => new MapModel(demoTrip));
  const snapshot = useMapModel(model);
  const [aiOpen, setAiOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const aiButtonRef = useRef<HTMLButtonElement>(null);
  const aiWasOpenRef = useRef(false);

  useEffect(() => {
    if (!aiOpen && aiWasOpenRef.current) {
      aiButtonRef.current?.focus({ preventScroll: true });
    }
    aiWasOpenRef.current = aiOpen;
  }, [aiOpen]);

  return (
    <main className="trip-map-page">
      <GoogleMapView
        days={snapshot.trip.days}
        routes={snapshot.routes}
        focusTarget={snapshot.focusTarget}
        selectedPlaceId={snapshot.selectedPlaceId}
        selectedDayId={snapshot.selectedDayId}
        onSelectPlace={model.selectPlace}
        sidebarRef={sidebarRef}
      />
      <TripSidebar
        selectionRevision={snapshot.focus.revision}
        trip={snapshot.trip}
        sidebarRef={sidebarRef}
        selectedPlaceId={snapshot.selectedPlaceId}
        selectedDayId={snapshot.selectedDayId}
        onSelectPlace={model.selectPlace}
        onSelectDay={model.selectDay}
        onShowAll={model.showAll}
        onMovePlace={model.movePlace}
      />
      <MapSearchBar />
      <MapAiButton
        ref={aiButtonRef}
        open={aiOpen}
        onClick={() => setAiOpen((open) => !open)}
      />
      <MapAiPanel open={aiOpen} onClose={() => setAiOpen(false)} />
    </main>
  );
}
