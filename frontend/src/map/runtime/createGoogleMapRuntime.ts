import { GoogleMapAdapter } from '../adapters/GoogleMapAdapter';
import { GoogleOverlayHost } from '../adapters/GoogleOverlayHost';
import { GoogleMapObjectController } from '../adapters/GoogleMapObjectController';
import type { MapRuntime, MapRuntimeConfig } from '../adapters/MapRuntime';
import { loadGoogleMaps, mapsConfig } from './googleMaps';

// Browser rendering infrastructure; data queries belong to src/api.
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
    google.maps.importLibrary('marker'),
  ]);
  // A remount or authentication failure can cancel initialization while loading.
  signal?.throwIfAborted();

  let adapter: GoogleMapAdapter | undefined;
  let overlayHost: GoogleOverlayHost | undefined;
  const eventRemovers = new Set<() => void>();
  let objects: GoogleMapObjectController | undefined;
  let instance: google.maps.Map | undefined;
  let disposed = false;
  const dispose = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    for (const remove of [...eventRemovers]) {
      remove();
    }
    objects?.dispose();
    overlayHost?.dispose();
    adapter?.dispose();
    instance = undefined;
    canvas.replaceChildren();
  };

  try {
    const { Map } = maps as google.maps.MapsLibrary;
    instance = new Map(canvas, {
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
    objects = new GoogleMapObjectController(instance);
    overlayHost = new GoogleOverlayHost();
    overlayHost.attach(instance);
    const camera = adapter;
    return {
      adapter,
      objects,
      overlayHost,
      setOptions(options) {
        if (!disposed) {
          instance?.setOptions(options);
        }
      },
      subscribeEvents(events) {
        if (disposed || !instance) {
          return () => undefined;
        }
        const listeners = [
          instance.addListener(
            'click',
            (event: google.maps.MapMouseEvent | google.maps.IconMouseEvent) => {
              const placeId = 'placeId' in event ? event.placeId : null;
              if (placeId) {
                // The application owns POI details; suppress Google's InfoWindow.
                event.stop();
              }
              if (!event.latLng) {
                return;
              }
              const point = event.latLng.toJSON();
              if (placeId) {
                events.onMapClick?.({ ...point, placeId });
                return;
              }
              events.onMapClick?.(point);
            },
          ),
          instance.addListener('center_changed', () => {
            const center = camera.getCenter();
            if (center) {
              events.onCenterChanged?.(center);
            }
          }),
          instance.addListener('zoom_changed', () => {
            events.onZoomChanged?.(camera.getZoom());
          }),
        ];
        const remove = () => {
          for (const listener of listeners) {
            listener.remove();
          }
          eventRemovers.delete(remove);
        };
        eventRemovers.add(remove);
        return remove;
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
