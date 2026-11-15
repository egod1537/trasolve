import { createGoogleMarker } from './createGoogleMarker';
import type {
  MapObjectController,
  MapObjectHandle,
  MapObjectBaseOptions,
  MapMarkerHandle,
  MapMarkerOptions,
  MapPolylineHandle,
  MapPolylineOptions,
  MapPolylineStyle,
  MapPolygonOptions,
  MapPolygonHandle,
} from '@/map/adapters/MapObjectController';
import '@/map/adapters/map-objects.css';
import {
  resolvePolylineStyle,
  updatePolylineStyle,
  createPolylineIcons,
  applyPolylineStyle,
  arePolylineStylesEqual,
  arePathsEqual,
} from '@/map/adapters/googlePolylineStyle';

type ObjectBinding = {
  setVisible(visible: boolean): void;
  setZIndex(zIndex: number): void;
  remove(): void;
};

export class GoogleMapObjectController implements MapObjectController {
  public constructor(map: google.maps.Map) {
    this.map = map;
  }

  public addMarker(options: MapMarkerOptions): MapMarkerHandle {
    return createGoogleMarker(
      this.map,
      this.reserveId(options.id),
      options,
      this.register.bind(this),
    );
  }

  public addPolyline(options: MapPolylineOptions): MapPolylineHandle {
    const id = this.reserveId(options.id);
    const style = resolvePolylineStyle(options.style);
    let path = options.path;
    let visible = options.visible ?? true;
    let zIndex = options.zIndex ?? 0;
    let line: google.maps.Polyline | null = new google.maps.Polyline({
      map: this.map,
      path: options.path.map((point) => ({ ...point })),
      visible,
      zIndex,
      strokeColor: style.color,
      strokeWeight: style.width,
      strokeOpacity: style.pattern === 'short-dash' ? 0 : style.opacity,
      icons: createPolylineIcons(style),
      clickable: false,
    });
    const listeners = new Set<google.maps.MapsEventListener>();
    const base = this.register(id, options.layer, {
      setVisible: (nextVisible) => {
        if (line && visible !== nextVisible) {
          line.setVisible(nextVisible);
          visible = nextVisible;
        }
      },
      setZIndex: (nextZIndex) => {
        if (line && zIndex !== nextZIndex) {
          line.setOptions({ zIndex: nextZIndex });
          zIndex = nextZIndex;
        }
      },
      remove: () => {
        for (const listener of listeners) {
          listener.remove();
        }
        listeners.clear();
        line?.setMap(null);
        line = null;
      },
    });
    return {
      ...base,
      setPath: (nextPath) => {
        if (line && !arePathsEqual(path, nextPath)) {
          line.setPath(nextPath.map((point) => ({ ...point })));
          path = nextPath;
        }
      },
      setStyle: (update: MapPolylineStyle) => {
        const nextStyle = { ...style };
        updatePolylineStyle(nextStyle, update);
        if (arePolylineStylesEqual(style, nextStyle)) {
          return;
        }
        Object.assign(style, nextStyle);
        applyPolylineStyle(line, style);
      },
      onClick: (callback) => {
        if (!line) {
          return () => undefined;
        }
        line.setOptions({ clickable: true });
        const listener = line.addListener(
          'click',
          (event: google.maps.PolyMouseEvent) => {
            if (!event.latLng) {
              return;
            }
            callback({ lat: event.latLng.lat(), lng: event.latLng.lng() });
          },
        );
        listeners.add(listener);
        return () => {
          listener.remove();
          listeners.delete(listener);
          if (!listeners.size) {
            line?.setOptions({ clickable: false });
          }
        };
      },
    };
  }

  public addPolygon(options: MapPolygonOptions): MapPolygonHandle {
    const id = this.reserveId(options.id);
    const polygon = new google.maps.Polygon({
      map: this.map,
      paths: options.path.map((point) => ({ ...point })),
      clickable: false,
      visible: options.visible ?? true,
      zIndex: options.zIndex ?? 0,
    });
    const base = this.register(id, options.layer, {
      setVisible: (value) => polygon.setVisible(value),
      setZIndex: (value) => polygon.setOptions({ zIndex: value }),
      remove: () => polygon.setMap(null),
    });
    const handle = {
      ...base,
      setPath: (path: MapPolygonOptions['path']) =>
        polygon.setPath(path.map((point) => ({ ...point }))),
      setStyle: (style: NonNullable<MapPolygonOptions['style']>) =>
        polygon.setOptions({
          strokeColor: style.strokeColor,
          strokeWeight: style.strokeWidth,
          strokeOpacity: style.strokeOpacity,
          fillColor: style.fillColor,
          fillOpacity: style.fillOpacity,
        }),
    };
    handle.setStyle(options.style ?? {});
    return handle;
  }

  public remove(object: MapObjectHandle): void {
    // A handle from another controller must not remove an object with the same ID.
    const registered = this.objects.get(object.id);
    if (registered?.remove === object.remove) {
      registered.remove();
    }
  }

  public clearLayer(layer: string): void {
    for (const id of [...(this.layers.get(layer) ?? [])]) {
      this.objects.get(id)?.remove();
    }
  }

  public clear(): void {
    for (const object of [...this.objects.values()]) {
      object.remove();
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.clear();
    this.map = null;
  }

  private readonly objects = new Map<string, MapObjectHandle>();
  private map: google.maps.Map | null;
  private readonly layers = new Map<string, Set<string>>();
  private nextId = 0;
  private disposed = false;

  private reserveId(id: MapObjectBaseOptions['id']): string {
    if (this.disposed || !this.map) {
      throw new Error('Map object controller has been disposed.');
    }
    if (id !== undefined) {
      if (this.objects.has(id)) {
        throw new Error(`Duplicate map object ID: ${id}`);
      }
      return id;
    }
    let generated: string;
    do {
      generated = `map-object-${++this.nextId}`;
    } while (this.objects.has(generated));
    return generated;
  }

  private register(
    id: string,
    layer: string | undefined,
    binding: ObjectBinding,
  ): MapObjectHandle {
    let removed = false;
    const handle: MapObjectHandle = {
      id,
      setVisible: (visible) => {
        if (!removed) {
          binding.setVisible(visible);
        }
      },
      setZIndex: (zIndex) => {
        if (!removed) {
          binding.setZIndex(zIndex);
        }
      },
      remove: () => {
        if (removed) {
          return;
        }
        removed = true;
        binding.remove();
        this.objects.delete(id);
        if (layer !== undefined) {
          const ids = this.layers.get(layer);
          ids?.delete(id);
          if (!ids?.size) {
            this.layers.delete(layer);
          }
        }
      },
    };
    this.objects.set(id, handle);
    if (layer !== undefined) {
      const ids = this.layers.get(layer) ?? new Set<string>();
      ids.add(id);
      this.layers.set(layer, ids);
    }
    return handle;
  }
}
