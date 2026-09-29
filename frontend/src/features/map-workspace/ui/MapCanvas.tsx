import { memo, useEffect, type ReactNode, type RefObject } from 'react';
import type { Trip } from '@trasolve/shared';
import { GoogleMap, useGoogleMap } from '@/map/components/GoogleMap';
import type {
  GoogleMapHandle,
  GoogleMapOptions,
  GoogleMapStatus,
} from '@/map/types/googleMapComponent';
import type { MapClickEvent } from '@/shared/types/mapTypes';
import type { GeoPoint } from '@/shared/types/mapTypes';
import {
  calculateBoundsZoom,
  calculateMapPadding,
} from '@/features/map-workspace/domain/cameraPolicy';
import type { MapFocusTarget } from '@/features/map-workspace/domain/mapUiTypes';
import { TripLayer } from '@/features/map-workspace/ui/TripLayer';
import { useTripRoutePaths } from '@/features/map-workspace/hooks/useRouteSegments';
import { useL, L } from '@/shared/i18n';

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
  const { adapter, objects, canvasRef, isZooming } = useGoogleMap();
  const routePaths = useTripRoutePaths(trip);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }
    let stopCameraChange: (() => void) | undefined;
    const canvas = canvasRef.current;
    const panel = sidebarRef.current;
    const padding = calculateMapPadding({
      canvasRect: canvas.getBoundingClientRect(),
      sidebarRect: panel?.getBoundingClientRect(),
      mobile: window.matchMedia('(max-width: 760px)').matches,
    });

    if (!focusTarget.bounds) {
      return;
    }
    stopCameraChange = adapter.subscribeCameraChange(() => {
      stopCameraChange?.();
      stopCameraChange = undefined;
      const currentZoom = adapter.getZoom();
      const zoom = calculateBoundsZoom(currentZoom);
      if (currentZoom > zoom) {
        adapter.setZoom(zoom);
      }
    });
    adapter.fitBounds(focusTarget.bounds, padding);
    return () => stopCameraChange?.();
  }, [adapter, canvasRef, focusTarget, sidebarRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    let resizeFrame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => adapter.resize());
    });
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(resizeFrame);
    };
  }, [adapter, canvasRef]);

  return (
    <>
      <TripLayer
        objects={objects}
        trip={trip}
        routePaths={routePaths}
        selectedPlaceId={selectedPlaceId}
        selectedPolylineId={selectedPolylineId}
        selectedDayId={selectedDayId}
        visibleDayIds={visibleDayIds}
        isZooming={isZooming}
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
          ? L('map:mapCanvas.renderMapStatus.title.mapLoading')
          : L('map:mapCanvas.renderMapStatus.title.canTLoadMap')}
      </h2>
      <p>
        {status === 'missing-key'
          ? L(
              'map:mapCanvas.renderMapStatus.description.onceYouVeEstablishedMapConnection',
            )
          : status === 'error'
            ? L(
                'map:mapCanvas.renderMapStatus.description.checkMapConnectionTryAgainYou',
              )
            : L('map:mapCanvas.renderMapStatus.description.waitMoment')}
      </p>
      {status === 'error' && (
        <button type="button" onClick={() => window.location.reload()}>
          {L('common:action.retry')}
        </button>
      )}
    </div>
  );
}

export const MapCanvas = memo(function MapCanvas(props: Props) {
  const L = useL();
  const { mapRef, onMapClick, overlay, ...tripObjectProps } = props;
  return (
    <GoogleMap
      ref={mapRef}
      className="trip-map-root"
      style={{ position: 'absolute', inset: 0, height: '100%' }}
      ariaLabel={L('map:mapCanvas.ariaLabel.travelLocationMap')}
      renderStatus={renderMapStatus}
      onMapClick={onMapClick}
      options={mapOptions}
    >
      <TripObjects {...tripObjectProps} />
      {overlay}
    </GoogleMap>
  );
});
