import { memo, useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  loadGoogleMaps,
  mapsAuthErrorEvent,
  mapsConfig,
} from '../../maps/googleMaps';
import { GoogleMapAdapter } from '../../adapters/map/GoogleMapAdapter';
import { GoogleOverlayHost } from '../../adapters/map/GoogleOverlayHost';
import type { MapAdapter } from '../../adapters/map/MapAdapter';
import type { MapOverlayHost } from '../../adapters/map/MapOverlayHost';
import type { MapFocusTarget } from '../../domain/map/mapTypes';
import { useMapProjection } from '../../hooks/useMapProjection';
import type { TripDay, TripRoute } from '../../types/trip';
import { MapMarker } from './MapMarker';
import { RoutePolyline } from './RoutePolyline';

type Props = {
  days: TripDay[];
  routes: TripRoute[];
  focusTarget: MapFocusTarget;
  selectedPlaceId: string | null;
  selectedDayId: string | null;
  onSelectPlace: (id: string) => void;
  sidebarRef: RefObject<HTMLElement | null>;
};

type MapRuntime = {
  adapter: MapAdapter;
  overlayHost: MapOverlayHost;
};

export const GoogleMapView = memo(function GoogleMapView({
  days,
  routes,
  focusTarget,
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
  const projection = useMapProjection(
    runtime?.adapter ?? null,
    runtime?.overlayHost ?? null,
    canvasRef,
    days,
    routes,
  );
  const projectedRoutes = selectedDayId
    ? [...projection.routes].sort(
        (left, right) =>
          Number(left.route.dayId === selectedDayId) -
          Number(right.route.dayId === selectedDayId),
      )
    : projection.routes;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapsConfig.apiKey) return;
    let disposed = false;
    let ownedRuntime: MapRuntime | null = null;
    let authRejected = false;
    const authFailed = () => {
      authRejected = true;
      if (!disposed) setStatus('error');
    };
    window.addEventListener(mapsAuthErrorEvent, authFailed);

    async function initialize() {
      try {
        await loadGoogleMaps();
        const [maps] = await Promise.all([
          google.maps.importLibrary('maps'),
          google.maps.importLibrary('core'),
        ]);
        if (disposed || authRejected) return;
        const { Map } = maps as google.maps.MapsLibrary;
        const instance = new Map(canvas!, {
          center: { lat: 35.6812, lng: 139.7671 },
          zoom: 12,
          mapId: mapsConfig.mapId,
          disableDefaultUI: true,
          zoomControl: false,
          gestureHandling: 'greedy',
          scrollwheel: true,
          disableDoubleClickZoom: false,
          keyboardShortcuts: true,
          clickableIcons: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });
        const adapter = new GoogleMapAdapter(instance);
        const overlayHost = new GoogleOverlayHost();
        ownedRuntime = { adapter, overlayHost };
        overlayHost.attach(instance);
        setRuntime(ownedRuntime);
        setStatus('ready');
      } catch {
        if (!disposed) setStatus('error');
      }
    }
    void initialize();
    return () => {
      disposed = true;
      window.removeEventListener(mapsAuthErrorEvent, authFailed);
      ownedRuntime?.overlayHost.dispose();
      ownedRuntime?.adapter.dispose();
      canvas.replaceChildren();
    };
  }, []);

  useEffect(() => {
    if (!runtime || !canvasRef.current) return;
    const { adapter } = runtime;
    let stopCameraChange: (() => void) | undefined;
    let resizeFrame = 0;

    const focusMap = () => {
      stopCameraChange?.();
      stopCameraChange = undefined;
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

      if (focusTarget.type === 'place') {
        const zoom = Math.max(adapter.getZoom(), 15);
        adapter.setZoom(zoom);
        // Pan once to an offset center; two concurrent pan animations can cancel.
        adapter.panTo(focusTarget.point, {
          x: (padding.right - padding.left) / 2,
          y: (padding.bottom - padding.top) / 2,
        });
        return;
      }

      if (!focusTarget.bounds) return;
      // One place (or coincident places) must not zoom all the way into a building.
      stopCameraChange = adapter.subscribeCameraChange(() => {
        stopCameraChange?.();
        stopCameraChange = undefined;
        if (adapter.getZoom() > 16) adapter.setZoom(16);
      });
      adapter.fitBounds(focusTarget.bounds, padding);
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
      stopCameraChange?.();
    };
  }, [runtime, focusTarget, sidebarRef]);

  return (
    <div className="trip-map-root">
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
      {runtime &&
        createPortal(
          <div className="trip-map-overlay">
            <svg
              className="trip-map-svg-overlay"
              aria-hidden="true"
              focusable="false"
            >
              {projectedRoutes.map(({ route, points }) => (
                <RoutePolyline
                  key={route.dayId}
                  route={route}
                  points={points}
                  active={!selectedDayId || selectedDayId === route.dayId}
                />
              ))}
            </svg>
            <div className="trip-map-dom-overlay">
              {projection.markers.map(
                ({ place, dayTitle, color, position }) => (
                  <MapMarker
                    key={place.id}
                    place={place}
                    dayTitle={dayTitle}
                    color={color}
                    selected={selectedPlaceId === place.id}
                    position={position}
                    onSelect={onSelectPlace}
                  />
                ),
              )}
            </div>
          </div>,
          runtime.overlayHost.getElement(),
        )}
    </div>
  );
});
