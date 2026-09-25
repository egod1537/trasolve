import type { TripPlace } from '@trasolve/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  MapMarkerContextMenuEvent,
  MapMarkerHandle,
} from '@/map/adapters/MapObjectController';
import { GoogleMap, useGoogleMap } from '@/map/components/GoogleMap';
import { useMapPolyline } from '@/map/hooks/useMapPolyline';
import { RouteEndpointContextMenu } from '@/features/route-optimization/ui/RouteEndpointContextMenu';
import { IconButton } from '@/shared/ui/IconButton';
import { ExpandIcon } from '@/shared/ui/icons';
import {
  getTripPolylineStyle,
  TRIP_POLYLINE_MODE_STYLES,
} from '@/entities/trip';

const COMPARISON_LINE_STYLE = getTripPolylineStyle('straight', false, true);
const COMPARISON_COLOR = TRIP_POLYLINE_MODE_STYLES.straight.color;

type Props = {
  title: 'Before' | 'After';
  ariaLabel: string;
  layer: string;
  places: readonly TripPlace[];
  viewportPlaces?: readonly TripPlace[];
  heading?: string;
  onExpand?: () => void;
  selectedStartPlaceId?: string;
  selectedEndPlaceId?: string;
  editableEndpoints?: boolean;
  onSetStartPlace?: (placeId: string) => void;
  onSetEndPlace?: (placeId: string) => void;
  onEndpointMenuOpenChange?: (open: boolean) => void;
};

export function RouteComparisonMap({
  title,
  ariaLabel,
  layer,
  places,
  viewportPlaces = places,
  heading = '지도',
  onExpand,
  selectedStartPlaceId = places[0]?.id,
  selectedEndPlaceId = places.at(-1)?.id,
  editableEndpoints = false,
  onSetStartPlace,
  onSetEndPlace,
  onEndpointMenuOpenChange,
}: Props) {
  const [endpointMenu, setEndpointMenu] = useState<{
    layer: string;
    placeId: string;
    x: number;
    y: number;
  } | null>(null);
  const activeEndpointMenu =
    endpointMenu?.layer === layer ? endpointMenu : null;
  const menuPlace = activeEndpointMenu
    ? places.find((place) => place.id === activeEndpointMenu.placeId)
    : undefined;
  const closeEndpointMenu = useCallback(() => {
    setEndpointMenu(null);
    onEndpointMenuOpenChange?.(false);
  }, [onEndpointMenuOpenChange]);

  return (
    <section className="route-optimization-map-panel">
      <header>
        <div>
          <strong>{heading}</strong>
          <span>
            {title === 'Before' ? '현재 방문 순서' : '최적화 방문 순서'}
          </span>
        </div>
        <span className="route-optimization-marker-legend">
          <i className="is-start" /> 시작점
          <i className="is-destination" /> 도착점
        </span>
      </header>
      <div className="route-optimization-map-canvas">
        <GoogleMap
          className="route-optimization-google-map"
          center={places[0]?.location ?? { lat: 37.5665, lng: 126.978 }}
          zoom={12}
          ariaLabel={ariaLabel}
          options={{
            clickableIcons: false,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          }}
        >
          <ComparisonViewport places={viewportPlaces} />
          <ComparisonLine
            layer={layer}
            path={places.map((place) => place.location)}
          />
          <ComparisonMarkers
            layer={layer}
            places={places}
            selectedStartPlaceId={selectedStartPlaceId}
            selectedEndPlaceId={selectedEndPlaceId}
            editableEndpoints={editableEndpoints}
            onMarkerContextMenu={
              editableEndpoints
                ? (placeId, event) => {
                    setEndpointMenu({
                      layer,
                      placeId,
                      x: event.clientX,
                      y: event.clientY,
                    });
                    onEndpointMenuOpenChange?.(true);
                  }
                : undefined
            }
          />
        </GoogleMap>
        {onExpand ? (
          <IconButton
            className="route-optimization-map-expand"
            aria-label={`${title} 경로 지도 확대`}
            icon={<ExpandIcon />}
            variant="secondary"
            size="sm"
            onClick={onExpand}
          />
        ) : null}
      </div>
      <p className="route-optimization-map-order">
        {places.map((place) => place.name).join(' → ')}
      </p>
      {activeEndpointMenu && menuPlace && onSetStartPlace && onSetEndPlace ? (
        <RouteEndpointContextMenu
          placeName={menuPlace.name}
          anchor={{ x: activeEndpointMenu.x, y: activeEndpointMenu.y }}
          isStart={menuPlace.id === selectedStartPlaceId}
          isEnd={menuPlace.id === selectedEndPlaceId}
          onSetStart={() => onSetStartPlace(menuPlace.id)}
          onSetEnd={() => onSetEndPlace(menuPlace.id)}
          onClose={closeEndpointMenu}
        />
      ) : null}
    </section>
  );
}

export function RouteComparisonPlaceholder({
  message,
  heading = '지도',
}: {
  message: string;
  heading?: string;
}) {
  return (
    <section className="route-optimization-map-panel">
      <header>
        <div>
          <strong>{heading}</strong>
          <span>최적화 방문 순서</span>
        </div>
      </header>
      <div className="route-optimization-map-placeholder" role="status">
        <p>{message}</p>
      </div>
      <p className="route-optimization-map-order">—</p>
    </section>
  );
}

function ComparisonViewport({ places }: { places: readonly TripPlace[] }) {
  const { adapter } = useGoogleMap();
  const signature = places
    .map((place) => `${place.id}:${place.location.lat}:${place.location.lng}`)
    .sort()
    .join('|');

  useEffect(() => {
    if (places.length === 0) {
      return;
    }
    if (places.length === 1) {
      adapter.panTo(places[0]!.location);
      adapter.setZoom(14);
      return;
    }
    const latitudes = places.map((place) => place.location.lat);
    const longitudes = places.map((place) => place.location.lng);
    adapter.fitBounds(
      {
        north: Math.max(...latitudes),
        south: Math.min(...latitudes),
        east: Math.max(...longitudes),
        west: Math.min(...longitudes),
      },
      { top: 44, right: 44, bottom: 44, left: 44 },
    );
  }, [adapter, places, signature]);
  return null;
}

function ComparisonLine({
  layer,
  path,
}: {
  layer: string;
  path: readonly { lat: number; lng: number }[];
}) {
  const { objects } = useGoogleMap();
  useMapPolyline(objects, {
    id: `${layer}:route`,
    layer: `${layer}-line`,
    path,
    style: COMPARISON_LINE_STYLE,
  });
  return null;
}

function ComparisonMarkers({
  layer,
  places,
  selectedStartPlaceId,
  selectedEndPlaceId,
  editableEndpoints,
  onMarkerContextMenu,
}: {
  layer: string;
  places: readonly TripPlace[];
  selectedStartPlaceId?: string;
  selectedEndPlaceId?: string;
  editableEndpoints: boolean;
  onMarkerContextMenu?: (
    placeId: string,
    event: MapMarkerContextMenuEvent,
  ) => void;
}) {
  const { objects } = useGoogleMap();
  const markers = useRef(new Map<string, MapMarkerHandle>());
  const contextMenuHandler = useRef(onMarkerContextMenu);

  useEffect(() => {
    contextMenuHandler.current = onMarkerContextMenu;
  }, [onMarkerContextMenu]);

  useEffect(() => {
    const ownedMarkers = markers.current;
    return () => {
      for (const marker of ownedMarkers.values()) {
        marker.remove();
      }
      ownedMarkers.clear();
    };
  }, [objects]);

  useEffect(() => {
    const remaining = new Set<string>();
    places.forEach((place, index) => {
      remaining.add(place.id);
      let marker = markers.current.get(place.id);
      if (!marker) {
        marker = objects.addMarker({
          id: `${layer}:${place.id}`,
          layer,
          position: place.location,
        });
        if (editableEndpoints) {
          marker.onContextMenu((event) =>
            contextMenuHandler.current?.(place.id, event),
          );
        }
        markers.current.set(place.id, marker);
      }
      const isStart = place.id === selectedStartPlaceId;
      const isEnd = place.id === selectedEndPlaceId;
      marker.setPosition(place.location);
      marker.setTitle(
        `${index + 1}. ${place.name}${
          isStart ? ' · 시작점' : isEnd ? ' · 도착점' : ''
        }`,
      );
      marker.setLabel(String(index + 1));
      marker.setColor(
        isStart ? '#16a34a' : isEnd ? '#dc2626' : COMPARISON_COLOR,
      );
      marker.setZIndex(
        isStart || isEnd ? places.length + index + 1 : index + 1,
      );
    });
    for (const [placeId, marker] of markers.current) {
      if (!remaining.has(placeId)) {
        marker.remove();
        markers.current.delete(placeId);
      }
    }
  }, [
    editableEndpoints,
    layer,
    objects,
    places,
    selectedEndPlaceId,
    selectedStartPlaceId,
  ]);
  return null;
}
