import { useCallback, useMemo, useRef, useState } from 'react';
import { GoogleMapView } from '../components/map/GoogleMapView';
import { MapSearchBar } from '../components/map/MapSearchBar';
import { TripSidebar } from '../components/map/TripSidebar';
import { demoTrip } from '../data/demoTrip';
import { buildTripRoutes, type MapFocus } from '../types/trip';
import '../styles/map.css';

export default function MapPage() {
  const [trip] = useState(demoTrip);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [focus, setFocus] = useState<MapFocus>({ type: 'all', revision: 0 });
  const sidebarRef = useRef<HTMLElement>(null);
  const routes = useMemo(() => buildTripRoutes(trip.days), [trip.days]);

  const selectPlace = useCallback(
    (placeId: string) => {
      const day = trip.days.find((item) =>
        item.places.some((place) => place.id === placeId),
      );
      if (!day) return;
      setSelectedPlaceId(placeId);
      setSelectedDayId(day.id);
      setFocus((previous) => ({
        type: 'place',
        placeId,
        revision: previous.revision + 1,
      }));
    },
    [trip.days],
  );

  const selectDay = useCallback((dayId: string) => {
    setSelectedDayId(dayId);
    setSelectedPlaceId(null);
    setFocus((previous) => ({
      type: 'day',
      dayId,
      revision: previous.revision + 1,
    }));
  }, []);

  const showAll = () => {
    setSelectedDayId(null);
    setSelectedPlaceId(null);
    setFocus((previous) => ({ type: 'all', revision: previous.revision + 1 }));
  };

  return (
    <main className="trip-map-page">
      <GoogleMapView
        days={trip.days}
        routes={routes}
        focus={focus}
        selectedPlaceId={selectedPlaceId}
        selectedDayId={selectedDayId}
        onSelectPlace={selectPlace}
        sidebarRef={sidebarRef}
      />
      <TripSidebar
        selectionRevision={focus.revision}
        trip={trip}
        sidebarRef={sidebarRef}
        selectedPlaceId={selectedPlaceId}
        selectedDayId={selectedDayId}
        onSelectPlace={selectPlace}
        onSelectDay={selectDay}
        onShowAll={showAll}
      />
      <MapSearchBar />
    </main>
  );
}
