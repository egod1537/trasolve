import { memo, useEffect, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { GoogleMap, useGoogleMap } from '../google-map/GoogleMap';
import type { GoogleMapStatus } from '../google-map/types';
import {
  calculateBoundsZoom,
  calculateMapPadding,
  calculatePlacePanOffset,
  calculatePlaceZoom,
} from '../../domain/map/cameraPolicy';
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

function TripMapOverlay({
  days,
  routes,
  focusTarget,
  selectedPlaceId,
  selectedDayId,
  onSelectPlace,
  sidebarRef,
}: Props) {
  const { adapter, overlayHost, canvasRef } = useGoogleMap();
  const projection = useMapProjection(
    adapter,
    overlayHost,
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
    if (!canvasRef.current) return;
    let stopCameraChange: (() => void) | undefined;
    let resizeFrame = 0;

    const focusMap = () => {
      stopCameraChange?.();
      stopCameraChange = undefined;
      const canvas = canvasRef.current!;
      const panel = sidebarRef.current;
      const padding = calculateMapPadding({
        canvasRect: canvas.getBoundingClientRect(),
        sidebarRect: panel?.getBoundingClientRect(),
        mobile: window.matchMedia('(max-width: 760px)').matches,
      });

      if (focusTarget.type === 'place') {
        const zoom = calculatePlaceZoom(adapter.getZoom());
        adapter.setZoom(zoom);
        // Pan once to an offset center; two concurrent pan animations can cancel.
        adapter.panTo(focusTarget.point, calculatePlacePanOffset(padding));
        return;
      }

      if (!focusTarget.bounds) return;
      stopCameraChange = adapter.subscribeCameraChange(() => {
        stopCameraChange?.();
        stopCameraChange = undefined;
        const currentZoom = adapter.getZoom();
        const zoom = calculateBoundsZoom(currentZoom);
        if (currentZoom > zoom) adapter.setZoom(zoom);
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
  }, [adapter, canvasRef, focusTarget, sidebarRef]);

  return createPortal(
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
        {projection.markers.map(({ place, dayTitle, color, position }) => (
          <MapMarker
            key={place.id}
            place={place}
            dayTitle={dayTitle}
            color={color}
            selected={selectedPlaceId === place.id}
            position={position}
            onSelect={onSelectPlace}
          />
        ))}
      </div>
    </div>,
    overlayHost.getElement(),
  );
}

function renderTripMapStatus(status: Exclude<GoogleMapStatus, 'ready'>) {
  return (
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
  );
}

export const GoogleMapView = memo(function GoogleMapView(props: Props) {
  return (
    <GoogleMap
      className="trip-map-root"
      style={{ position: 'absolute', inset: 0, height: '100%' }}
      ariaLabel="여행 장소 지도"
      renderStatus={renderTripMapStatus}
    >
      <TripMapOverlay {...props} />
    </GoogleMap>
  );
});
