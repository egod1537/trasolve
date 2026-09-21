import { GoogleMapAdapter } from '@/map/adapters/GoogleMapAdapter';
import { GoogleOverlayHost } from '@/map/adapters/GoogleOverlayHost';
import type { MapRuntime, MapRuntimeConfig } from '@/map/adapters/MapRuntime';
import { loadGoogleMaps, mapsConfig } from '@/map/runtime/googleMaps';
import { getGoogleMapThemeOptions } from '@/map/runtime/googleMapTheme';

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
  let instance: google.maps.Map | undefined;
  let disposed = false;
  const dispose = () => {
    if (disposed) {
      return;
    }
    disposed = true;
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
      ...getGoogleMapThemeOptions(config.theme ?? 'light'),
      ...config.options,
    });
    adapter = new GoogleMapAdapter(instance);
    overlayHost = new GoogleOverlayHost();
    overlayHost.attach(instance);
    return {
      adapter,
      objects: adapter,
      overlayHost,
      setOptions(options) {
        if (!disposed) {
          adapter?.setOptions(options);
        }
      },
      subscribeEvents(events) {
        if (disposed) {
          return () => undefined;
        }
        return adapter?.subscribeEvents(events) ?? (() => undefined);
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
