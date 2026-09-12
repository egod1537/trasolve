import { memo, useEffect, type ReactNode, type RefObject } from 'react';
import type { Trip } from '@trasolve/shared';
import { GoogleMap, useGoogleMap } from '../../../../map/components/GoogleMap';
import type {
  GoogleMapHandle,
  GoogleMapOptions,
  GoogleMapStatus,
} from '../../../../map/types/googleMapComponent';
import type { MapClickEvent } from '../../../../map/types/mapTypes';
import type { GeoPoint } from '../../../../map/types/mapTypes';
import {
  calculateBoundsZoom,
  calculateMapPadding,
} from '../../domain/cameraPolicy';
import type { MapFocusTarget } from '../../domain/mapUiTypes';
import { TripLayer } from './TripLayer';

type TripObjectsProps = {
  trip: Trip;
  focusTarget: MapFocusTarget;
  selectedPlaceId: string | null;
  selectedPolylineId: string | null;
  selectedDayId: string | null;
  visibleDayIds: ReadonlySet<string>;
  onSelectPlace: (id: string) => void;
  onSelectPolyline: (id: string, anchor: GeoPoint) => void;
  sidebarRef: RefObject<HTMLElement | null>;
};

type Props = TripObjectsProps & {
  onMapClick: (event: MapClickEvent) => void;
  mapRef?: RefObject<GoogleMapHandle | null>;
  overlay?: ReactNode;
};

const mapOptions: GoogleMapOptions = { clickableIcons: true };

const TripObjects = memo(function TripObjects({
  trip,
  focusTarget,
  selectedPlaceId,
  selectedPolylineId,
  selectedDayId,
  visibleDayIds,
  onSelectPlace,
  onSelectPolyline,
  sidebarRef,
}: TripObjectsProps) {
  const { adapter, objects, canvasRef } = useGoogleMap();

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

  return (
    <>
      <TripLayer
        objects={objects}
        trip={trip}
        selectedPlaceId={selectedPlaceId}
        selectedPolylineId={selectedPolylineId}
        selectedDayId={selectedDayId}
        visibleDayIds={visibleDayIds}
        onSelectPlace={onSelectPlace}
        onSelectPolyline={onSelectPolyline}
      />
    </>
  );
});

function renderMapStatus(status: Exclude<GoogleMapStatus, 'ready'>) {
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
  const { mapRef, onMapClick, overlay, ...tripObjectProps } = props;
  return (
    <GoogleMap
      ref={mapRef}
      className="trip-map-root"
      style={{ position: 'absolute', inset: 0, height: '100%' }}
      ariaLabel="여행 장소 지도"
      renderStatus={renderMapStatus}
      onMapClick={onMapClick}
      options={mapOptions}
    >
      <TripObjects {...tripObjectProps} />
      {overlay}
    </GoogleMap>
  );
});
