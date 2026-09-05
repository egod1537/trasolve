import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  loadGoogleMaps,
  mapsAuthErrorEvent,
  mapsConfig,
} from '../../maps/googleMaps';
import type { MapFocus, TripDay, TripRoute } from '../../types/trip';
import { MapMarker } from './MapMarker';
import { RoutePolyline } from './RoutePolyline';

type Props = {
  days: TripDay[];
  routes: TripRoute[];
  focus: MapFocus;
  selectedPlaceId: string | null;
  selectedDayId: string | null;
  onSelectPlace: (id: string) => void;
  sidebarRef: RefObject<HTMLElement | null>;
};

type MapRuntime = {
  map: google.maps.Map;
  markerLibrary: google.maps.MarkerLibrary;
};

export function GoogleMapView({
  days,
  routes,
  focus,
  selectedPlaceId,
  selectedDayId,
  onSelectPlace,
  sidebarRef,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [runtime, setRuntime] = useState<MapRuntime | null>(null);
  const [status, setStatus] = useState<
    'loading' | 'ready' | 'missing-key' | 'error'
  >(mapsConfig.apiKey ? 'loading' : 'missing-key');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapsConfig.apiKey) return;
    let disposed = false;
    let authRejected = false;
    let instance: google.maps.Map | undefined;
    const authFailed = () => {
      authRejected = true;
      if (!disposed) setStatus('error');
    };
    window.addEventListener(mapsAuthErrorEvent, authFailed);

    async function initialize() {
      try {
        await loadGoogleMaps();
        const [maps, marker] = await Promise.all([
          google.maps.importLibrary('maps'),
          google.maps.importLibrary('marker'),
          google.maps.importLibrary('core'),
        ]);
        if (disposed || authRejected) return;
        const { Map } = maps as google.maps.MapsLibrary;
        instance = new Map(canvas!, {
          center: { lat: 35.6812, lng: 139.7671 },
          zoom: 12,
          mapId: mapsConfig.mapId,
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: {
            position: google.maps.ControlPosition.RIGHT_BOTTOM,
          },
          gestureHandling: 'greedy',
          scrollwheel: true,
          disableDoubleClickZoom: false,
          keyboardShortcuts: true,
          clickableIcons: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });
        setRuntime({
          map: instance,
          markerLibrary: marker as google.maps.MarkerLibrary,
        });
        setStatus('ready');
      } catch {
        if (!disposed) setStatus('error');
      }
    }
    void initialize();
    return () => {
      disposed = true;
      window.removeEventListener(mapsAuthErrorEvent, authFailed);
      if (instance) google.maps.event.clearInstanceListeners(instance);
      canvas.replaceChildren();
    };
  }, []);

  useEffect(() => {
    if (!runtime || !canvasRef.current) return;
    const { map } = runtime;
    const allPlaces = days.flatMap((day) => day.places);
    let idleListener: google.maps.MapsEventListener | undefined;
    let resizeFrame = 0;

    const focusMap = () => {
      idleListener?.remove();
      const canvas = canvasRef.current!;
      const panel = sidebarRef.current;
      const rect = canvas.getBoundingClientRect();
      const panelRect = panel?.getBoundingClientRect();
      // Reserve the panel and search area while keeping the map full-bleed.
      const mobile = window.matchMedia('(max-width: 760px)').matches;
      const padding = {
        top: 88,
        right: mobile ? 44 : 64,
        bottom: mobile && panelRect ? rect.bottom - panelRect.top + 24 : 56,
        left: !mobile && panelRect ? panelRect.right - rect.left + 32 : 40,
      };

      if (focus.type === 'place') {
        const place = allPlaces.find((item) => item.id === focus.placeId);
        if (!place) return;
        const zoom = Math.max(map.getZoom() ?? 12, 15);
        map.setZoom(zoom);
        const projection = map.getProjection();
        const location = new google.maps.LatLng(place.lat, place.lng);
        const point = projection?.fromLatLngToPoint(location);
        // Pan once to an offset center; two concurrent pan animations can cancel.
        const center =
          point && projection
            ? projection.fromPointToLatLng(
                new google.maps.Point(
                  point.x + (padding.right - padding.left) / (2 * 2 ** zoom),
                  point.y + (padding.bottom - padding.top) / (2 * 2 ** zoom),
                ),
              )
            : location;
        map.panTo(center ?? location);
        return;
      }

      const places =
        focus.type === 'day'
          ? (days.find((day) => day.id === focus.dayId)?.places ?? [])
          : allPlaces;
      if (!places.length) return;
      const bounds = new google.maps.LatLngBounds();
      places.forEach(({ lat, lng }) => bounds.extend({ lat, lng }));
      // One place (or coincident places) must not zoom all the way into a building.
      idleListener = google.maps.event.addListenerOnce(map, 'idle', () => {
        if ((map.getZoom() ?? 0) > 16) map.setZoom(16);
      });
      map.fitBounds(bounds, padding);
    };
    focusMap();
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(focusMap);
    });
    observer.observe(canvasRef.current);
    if (sidebarRef.current) observer.observe(sidebarRef.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(resizeFrame);
      idleListener?.remove();
    };
  }, [runtime, days, focus, sidebarRef]);

  return (
    <>
      <div
        ref={canvasRef}
        className="trip-map-canvas"
        aria-label="여행 장소 지도"
      />
      {status !== 'ready' && (
        <div
          className="trip-map-status"
          role={status === 'error' ? 'alert' : 'status'}
        >
          <h2>
            {status === 'loading'
              ? '지도를 불러오고 있습니다'
              : '지도를 불러올 수 없습니다'}
          </h2>
          <p>
            {status === 'missing-key'
              ? '지도 연결을 설정하면 일정의 장소와 경로가 표시됩니다. 왼쪽에서 예시 일정을 둘러볼 수 있습니다.'
              : status === 'error'
                ? '지도 연결을 확인한 뒤 다시 시도해 주세요. 일정 목록은 계속 확인할 수 있습니다.'
                : '잠시만 기다려 주세요.'}
          </p>
          {status === 'error' && (
            <button type="button" onClick={() => window.location.reload()}>
              다시 시도
            </button>
          )}
        </div>
      )}
      {runtime && (
        <>
          {days.flatMap((day) =>
            day.places.map((place) => (
              <MapMarker
                key={place.id}
                map={runtime.map}
                markerLibrary={runtime.markerLibrary}
                place={place}
                dayTitle={day.title}
                color={day.color}
                selected={selectedPlaceId === place.id}
                onSelect={onSelectPlace}
              />
            )),
          )}
          {routes
            .filter((route) => route.path.length > 1)
            .map((route) => (
              <RoutePolyline
                key={route.dayId}
                map={runtime.map}
                route={route}
                active={!selectedDayId || selectedDayId === route.dayId}
              />
            ))}
        </>
      )}
    </>
  );
}
