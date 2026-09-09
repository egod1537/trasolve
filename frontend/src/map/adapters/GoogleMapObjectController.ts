import type {
  MapObjectController,
  MapObjectHandle,
  MapObjectBaseOptions,
  MapMarkerHandle,
  MapMarkerOptions,
  MapPolylineHandle,
  MapPolylineOptions,
  MapPolylineStyle,
} from './MapObjectController';
import './map-objects.css';

type ObjectBinding = {
  setVisible(visible: boolean): void;
  setZIndex(zIndex: number): void;
  remove(): void;
};

// Owns native SDK objects only; no React lifecycle or application state.
export class GoogleMapObjectController implements MapObjectController {
  public constructor(map: google.maps.Map) {
    this.map = map;
  }

  public addMarker(options: MapMarkerOptions): MapMarkerHandle {
    const id = this.reserveId(options.id);
    const content = document.createElement('span');
    content.className = 'trip-map-marker';
    content.setAttribute('aria-hidden', 'true');
    let marker: google.maps.marker.AdvancedMarkerElement | null =
      new google.maps.marker.AdvancedMarkerElement({
        map: options.visible === false ? null : this.map,
        position: { ...options.position },
        zIndex: options.zIndex ?? 0,
        gmpClickable: true,
        anchorLeft: '-50%',
        anchorTop: '-50%',
      });
    marker.replaceChildren(content);
    const listeners = new Set<() => void>();
    const base = this.register(id, options.layer, {
      setVisible: (visible) => {
        if (marker) marker.map = visible ? this.map : null;
      },
      setZIndex: (zIndex) => {
        if (marker) marker.zIndex = zIndex;
      },
      remove: () => {
        for (const unsubscribe of [...listeners]) unsubscribe();
        if (marker) {
          marker.map = null;
          marker.replaceChildren();
          marker = null;
        }
        content.remove();
      },
    });
    const handle: MapMarkerHandle = {
      ...base,
      setPosition: (position) => {
        if (marker) marker.position = { ...position };
      },
      setLabel: (label) => {
        if (marker) content.textContent = label ?? '';
      },
      setTitle: (title) => {
        if (marker) marker.title = title ?? '';
      },
      setSelected: (selected) => {
        if (!marker) return;
        content.classList.toggle('is-selected', selected);
        marker.setAttribute('aria-pressed', String(selected));
      },
      setColor: (color) => {
        if (marker)
          content.style.setProperty('--day-color', color ?? '#2563eb');
      },
      onClick: (callback) => {
        if (!marker) return () => undefined;
        let target: google.maps.marker.AdvancedMarkerElement | null = marker;
        const listener = () => callback();
        target.addEventListener('gmp-click', listener);
        const unsubscribe = () => {
          target?.removeEventListener('gmp-click', listener);
          target = null;
          listeners.delete(unsubscribe);
        };
        listeners.add(unsubscribe);
        return unsubscribe;
      },
    };
    handle.setLabel(options.label);
    handle.setTitle(options.title);
    handle.setSelected(options.selected ?? false);
    handle.setColor(options.color);
    return handle;
  }

  public addPolyline(options: MapPolylineOptions): MapPolylineHandle {
    const id = this.reserveId(options.id);
    let line: google.maps.Polyline | null = new google.maps.Polyline({
      map: this.map,
      path: options.path.map((point) => ({ ...point })),
      visible: options.visible ?? true,
      zIndex: options.zIndex ?? 0,
      strokeColor: options.style?.color ?? '#2563eb',
      strokeWeight: options.style?.width ?? 5,
      strokeOpacity: options.style?.opacity ?? 0.85,
      clickable: false,
    });
    const base = this.register(id, options.layer, {
      setVisible: (visible) => line?.setVisible(visible),
      setZIndex: (zIndex) => line?.setOptions({ zIndex }),
      remove: () => {
        line?.setMap(null);
        line = null;
      },
    });
    return {
      ...base,
      setPath: (path) => line?.setPath(path.map((point) => ({ ...point }))),
      setStyle: (style: MapPolylineStyle) => {
        const update: google.maps.PolylineOptions = {};
        if (style.color !== undefined) update.strokeColor = style.color;
        if (style.width !== undefined) update.strokeWeight = style.width;
        if (style.opacity !== undefined) update.strokeOpacity = style.opacity;
        line?.setOptions(update);
      },
    };
  }

  public remove(object: MapObjectHandle): void {
    // A handle from another controller must not remove an object with the same ID.
    const registered = this.objects.get(object.id);
    if (registered?.remove === object.remove) registered.remove();
  }

  public clearLayer(layer: string): void {
    for (const id of [...(this.layers.get(layer) ?? [])]) {
      this.objects.get(id)?.remove();
    }
  }

  public clear(): void {
    for (const object of [...this.objects.values()]) object.remove();
  }

  public dispose(): void {
    if (this.disposed) return;
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
      if (this.objects.has(id))
        throw new Error(`Duplicate map object ID: ${id}`);
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
        if (!removed) binding.setVisible(visible);
      },
      setZIndex: (zIndex) => {
        if (!removed) binding.setZIndex(zIndex);
      },
      remove: () => {
        if (removed) return;
        removed = true;
        binding.remove();
        this.objects.delete(id);
        if (layer !== undefined) {
          const ids = this.layers.get(layer);
          ids?.delete(id);
          if (!ids?.size) this.layers.delete(layer);
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
