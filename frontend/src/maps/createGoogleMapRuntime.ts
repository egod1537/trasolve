import { GoogleMapAdapter } from '../adapters/map/GoogleMapAdapter';
import { GoogleOverlayHost } from '../adapters/map/GoogleOverlayHost';
import type { MapAdapter } from '../adapters/map/MapAdapter';
import type { MapOverlayHost } from '../adapters/map/MapOverlayHost';
import { loadGoogleMaps, mapsConfig } from './googleMaps';
import type {
  GoogleMapEvents,
  GoogleMapOptions,
  LatLng,
  MapPolyline,
} from '../components/google-map/types';

export type MapRuntime = {
  adapter: MapAdapter;
  overlayHost: MapOverlayHost;
  setOptions(options: GoogleMapOptions): void;
  subscribeEvents(events: GoogleMapEvents): () => void;
  setPolylines(polylines: readonly MapPolyline[]): void;
  dispose(): void;
};

type MapRuntimeConfig = {
  center?: LatLng;
  zoom?: number;
  mapId?: string;
  options?: GoogleMapOptions;
};

export async function createGoogleMapRuntime(
  canvas: HTMLElement,
  signal?: AbortSignal,
  config: MapRuntimeConfig = {},
): Promise<MapRuntime> {
  signal?.throwIfAborted();
  await loadGoogleMaps();
  const [maps] = await Promise.all([
    google.maps.importLibrary('maps'),
    google.maps.importLibrary('core'),
  ]);
  // A remount or authentication failure can cancel initialization while loading.
  signal?.throwIfAborted();

  let adapter: GoogleMapAdapter | undefined;
  let overlayHost: GoogleOverlayHost | undefined;
  const eventRemovers = new Set<() => void>();
  let polylines: google.maps.Polyline[] = [];
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const remove of [...eventRemovers]) remove();
    for (const polyline of polylines) polyline.setMap(null);
    polylines = [];
    overlayHost?.dispose();
    adapter?.dispose();
    canvas.replaceChildren();
  };

  try {
    const { Map } = maps as google.maps.MapsLibrary;
    const instance = new Map(canvas, {
      center: config.center ?? { lat: 35.6812, lng: 139.7671 },
      zoom: config.zoom ?? 12,
      mapId: config.mapId ?? mapsConfig.mapId,
      disableDefaultUI: true,
      zoomControl: false,
      gestureHandling: 'greedy',
      scrollwheel: true,
      disableDoubleClickZoom: false,
      keyboardShortcuts: true,
      clickableIcons: true,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
      ...config.options,
    });
    adapter = new GoogleMapAdapter(instance);
    overlayHost = new GoogleOverlayHost();
    overlayHost.attach(instance);
    const camera = adapter;
    return {
      adapter,
      overlayHost,
      setOptions(options) {
        if (!disposed) instance.setOptions(options);
      },
      subscribeEvents(events) {
        if (disposed) return () => undefined;
        const listeners = [
          instance.addListener(
            'click',
            (event: google.maps.MapMouseEvent | google.maps.IconMouseEvent) => {
              if (!event.latLng) return;
              const point = event.latLng.toJSON();
              events.onMapClick?.(
                'placeId' in event && event.placeId
                  ? { ...point, placeId: event.placeId }
                  : point,
              );
            },
          ),
          instance.addListener('center_changed', () => {
            const center = camera.getCenter();
            if (center) events.onCenterChanged?.(center);
          }),
          instance.addListener('zoom_changed', () => {
            events.onZoomChanged?.(camera.getZoom());
          }),
        ];
        const remove = () => {
          for (const listener of listeners) listener.remove();
          eventRemovers.delete(remove);
        };
        eventRemovers.add(remove);
        return remove;
      },
      setPolylines(next) {
        if (disposed) return;
        for (const polyline of polylines) polyline.setMap(null);
        polylines = next.map(
          (line) =>
            new google.maps.Polyline({
              map: instance,
              path: [...line.path],
              strokeColor: line.color ?? '#2563eb',
              strokeWeight: line.weight ?? 5,
              strokeOpacity: line.opacity ?? 0.85,
              clickable: false,
            }),
        );
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
