import { matchesLayoutMaxWidth } from '@/shared/config/mobileLayout';
import { memo, useEffect, type RefObject } from 'react';
import { GoogleMap, useGoogleMap } from '@/map/components/GoogleMap';
import type {
  GoogleMapOptions,
  GoogleMapStatus,
} from '@/map/types/googleMapComponent';
import {
  calculateBoundsZoom,
  calculateMapCenterOffset,
  calculateMapPadding,
  calculatePointFocusZoom,
} from '@/features/map-workspace/domain/cameraPolicy';
import { TripLayer } from '@/features/map-workspace/ui/TripLayer';
import { getExternalApiDisabledMessage } from '@/shared/api/externalApiDisabled';
import { useL, L } from '@/shared/i18n';
import { MeasurementLayer } from '../measurement/MeasurementLayer';
import { RouteComparisonLayer } from '@/features/route-optimization';

import type {
  MapSelectionActions,
  TripMapView,
} from '../model/mapViewportTypes';
import type { MapCanvasProps } from './mapViewportProps';

type TripObjectsProps = TripMapView &
  Omit<MapSelectionActions, 'onMapClick'> & {
    sidebarRef: RefObject<HTMLElement | null>;
  };

const mapOptions: GoogleMapOptions = { clickableIcons: true };
const noVisibleDays: ReadonlySet<string> = new Set();

const TripObjects = memo(function TripObjects({
  trip,
  focusTarget,
  selectedPlaceId,
  selectedPolylineId,
  selectedDayId,
  visibleDayIds,
  onSelectPlace,
  onFocusPlace,
  onSelectPolyline,
  sidebarRef,
}: TripObjectsProps) {
  const { adapter, objects, canvasRef, isZooming } = useGoogleMap();

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }
    let stopCameraChange: (() => void) | undefined;
    const canvas = canvasRef.current;
    const panel = sidebarRef.current;
    const padding = calculateMapPadding({
      canvasRect: canvas.getBoundingClientRect(),
      sidebarRect:
        panel?.dataset.mobileActive === 'false'
          ? undefined
          : panel?.getBoundingClientRect(),
      mobile: matchesLayoutMaxWidth(760),
    });

    const navigation = panel
      ?.closest('.trip-map-page')
      ?.querySelector('.mobile-map-navigation');
    if (matchesLayoutMaxWidth(760) && navigation) {
      padding.bottom = Math.max(
        padding.bottom,
        navigation.getBoundingClientRect().height + 72,
      );
    }

    if (focusTarget.type === 'point') {
      if (focusTarget.point) {
        const currentZoom = adapter.getZoom();
        const focusZoom = calculatePointFocusZoom(currentZoom);
        if (currentZoom < focusZoom) {
          adapter.setZoom(focusZoom);
        }
        adapter.panTo(focusTarget.point, calculateMapCenterOffset(padding));
      }
      return;
    }
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
        selectedPlaceId={selectedPlaceId}
        selectedPolylineId={selectedPolylineId}
        selectedDayId={selectedDayId}
        visibleDayIds={visibleDayIds}
        isZooming={isZooming}
        onSelectPlace={onSelectPlace}
        onFocusPlace={onFocusPlace}
        onSelectPolyline={onSelectPolyline}
      />
    </>
  );
});

function renderMapStatus(status: Exclude<GoogleMapStatus, 'ready'>) {
  return (
    <div
      className="trip-map-status"
      role={status === 'error' || status === 'disabled' ? 'alert' : 'status'}
    >
      <h2>
        {status === 'loading'
          ? L('map:mapCanvas.renderMapStatus.title.mapLoading')
          : L('map:mapCanvas.renderMapStatus.title.canTLoadMap')}
      </h2>
      <p>
        {status === 'disabled'
          ? getExternalApiDisabledMessage('google-maps')
          : status === 'missing-key'
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

export const MapCanvas = memo(function MapCanvas(props: MapCanvasProps) {
  const L = useL();
  const {
    mapRef,
    measurement,
    onMapClick,
    overlay,
    comparison,
    comparisonMode,
    comparisonSidebarRef,
    ...tripObjectProps
  } = props;
  return (
    <GoogleMap
      ref={mapRef}
      className="trip-map-root"
      style={{ position: 'absolute', inset: 0, height: '100%' }}
      ariaLabel={L('map:mapCanvas.ariaLabel.travelLocationMap')}
      renderStatus={renderMapStatus}
      onMapClick={comparison ? undefined : onMapClick}
      options={
        measurement && measurement.tool !== 'pan'
          ? {
              ...mapOptions,
              clickableIcons: false,
              disableDoubleClickZoom: true,
            }
          : mapOptions
      }
    >
      {measurement && !comparison && (
        <MeasurementLayer measurement={measurement} />
      )}
      <TripObjects
        {...tripObjectProps}
        onFocusPlace={
          measurement && measurement.tool !== 'pan'
            ? () => undefined
            : tripObjectProps.onFocusPlace
        }
        visibleDayIds={
          comparison ? noVisibleDays : tripObjectProps.visibleDayIds
        }
      />
      {comparison ? (
        <RouteComparisonLayer
          data={comparison}
          mode={comparisonMode ?? 'result'}
          sidebarRef={comparisonSidebarRef ?? tripObjectProps.sidebarRef}
        />
      ) : (
        overlay
      )}
    </GoogleMap>
  );
});
