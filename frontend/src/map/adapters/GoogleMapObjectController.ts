import type {
  MapObjectController,
  MapObjectHandle,
  MapObjectBaseOptions,
  MapMarkerHandle,
  MapMarkerIcon,
  MapMarkerOptions,
  MapPolylineHandle,
  MapPolylineOptions,
  MapPolylinePattern,
  MapPolylineStyle,
} from './MapObjectController';
import './map-objects.css';

type ObjectBinding = {
  setVisible(visible: boolean): void;
  setZIndex(zIndex: number): void;
  remove(): void;
};

type ResolvedPolylineStyle = {
  color: string;
  width: number;
  opacity: number;
  pattern: MapPolylinePattern;
  patternRepeatPx: number;
  directional: boolean;
  directionRepeatPx: number;
  directionScale: number;
};

const DIRECTION_ARROW_OUTLINE_COLOR = '#ffffff';
const DIRECTION_ARROW_OUTLINE_WIDTH = 1.5;

function resolvePolylineStyle(
  style: MapPolylineStyle | undefined,
): ResolvedPolylineStyle {
  return {
    color: style?.color ?? '#2563eb',
    width: style?.width ?? 5,
    opacity: style?.opacity ?? 0.85,
    pattern: style?.pattern ?? 'solid',
    patternRepeatPx: style?.patternRepeatPx ?? 20,
    directional: style?.directional ?? false,
    directionRepeatPx: style?.directionRepeatPx ?? 88,
    directionScale: style?.directionScale ?? 3.5,
  };
}

function updatePolylineStyle(
  current: ResolvedPolylineStyle,
  update: MapPolylineStyle,
): void {
  for (const key of Object.keys(update) as Array<keyof MapPolylineStyle>) {
    const value = update[key];
    if (value !== undefined) {
      Object.assign(current, { [key]: value });
    }
  }
}

function createPolylineIcons(
  style: ResolvedPolylineStyle,
): google.maps.IconSequence[] {
  const icons: google.maps.IconSequence[] = [];
  if (style.pattern === 'short-dash') {
    icons.push({
      icon: {
        path: 'M 0,-2 0,2',
        scale: 1,
        strokeColor: style.color,
        strokeOpacity: style.opacity,
        strokeWeight: style.width,
      },
      offset: '0',
      repeat: `${style.patternRepeatPx}px`,
    });
  } else if (style.pattern === 'stations') {
    icons.push({
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: style.color,
        fillOpacity: style.opacity,
        scale: Math.max(2.4, style.width * 0.55),
        strokeColor: '#ffffff',
        strokeOpacity: style.opacity,
        strokeWeight: 1,
      },
      offset: `${Math.round(style.patternRepeatPx / 2)}px`,
      repeat: `${style.patternRepeatPx}px`,
    });
  }
  if (style.directional) {
    const directionIcon: google.maps.Symbol = {
      path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      fillColor: style.color,
      fillOpacity: style.opacity,
      scale: style.directionScale,
      strokeColor: DIRECTION_ARROW_OUTLINE_COLOR,
      strokeOpacity: 1,
      strokeWeight: DIRECTION_ARROW_OUTLINE_WIDTH,
    };
    icons.push({
      icon: directionIcon,
      offset: '50%',
    });
    icons.push({
      icon: directionIcon,
      offset: `${Math.round(style.directionRepeatPx / 2)}px`,
      repeat: `${style.directionRepeatPx}px`,
    });
  }
  return icons;
}

function applyPolylineStyle(
  line: google.maps.Polyline | null,
  style: ResolvedPolylineStyle,
): void {
  line?.setOptions({
    strokeColor: style.color,
    strokeWeight: style.width,
    strokeOpacity: style.pattern === 'short-dash' ? 0 : style.opacity,
    icons: createPolylineIcons(style),
  });
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

function applyMarkerIcon(
  svg: SVGSVGElement,
  icon: MapMarkerIcon | undefined,
): void {
  svg.replaceChildren();
  svg.setAttribute('viewBox', icon?.viewBox ?? '0 0 24 24');
  for (const pathData of icon?.paths ?? []) {
    const path = document.createElementNS(SVG_NAMESPACE, 'path');
    path.setAttribute('d', pathData);
    svg.append(path);
  }
}

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
    const markerIcon = document.createElementNS(SVG_NAMESPACE, 'svg');
    markerIcon.classList.add('trip-map-marker-icon');
    markerIcon.setAttribute('fill', 'none');
    content.replaceChildren(markerIcon);
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
          content.style.setProperty('--place-color', color ?? '#2563eb');
      },
      setIcon: (icon) => {
        if (marker) applyMarkerIcon(markerIcon, icon);
      },
      setEmphasis: (emphasis) => {
        if (!marker) return;
        for (const value of ['selectable', 'source', 'target', 'unavailable']) {
          content.classList.toggle(`is-drawing-${value}`, emphasis === value);
        }
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
      onPointerEnter: (callback) => {
        const listener = () => callback();
        content.addEventListener('pointerenter', listener);
        const unsubscribe = () => {
          content.removeEventListener('pointerenter', listener);
          listeners.delete(unsubscribe);
        };
        listeners.add(unsubscribe);
        return unsubscribe;
      },
      onPointerLeave: (callback) => {
        const listener = () => callback();
        content.addEventListener('pointerleave', listener);
        const unsubscribe = () => {
          content.removeEventListener('pointerleave', listener);
          listeners.delete(unsubscribe);
        };
        listeners.add(unsubscribe);
        return unsubscribe;
      },
    };
    handle.setTitle(options.title);
    handle.setSelected(options.selected ?? false);
    handle.setColor(options.color);
    handle.setIcon(options.icon);
    handle.setEmphasis('none');
    return handle;
  }

  public addPolyline(options: MapPolylineOptions): MapPolylineHandle {
    const id = this.reserveId(options.id);
    const style = resolvePolylineStyle(options.style);
    let line: google.maps.Polyline | null = new google.maps.Polyline({
      map: this.map,
      path: options.path.map((point) => ({ ...point })),
      visible: options.visible ?? true,
      zIndex: options.zIndex ?? 0,
      strokeColor: style.color,
      strokeWeight: style.width,
      strokeOpacity: style.pattern === 'short-dash' ? 0 : style.opacity,
      icons: createPolylineIcons(style),
      clickable: false,
    });
    const listeners = new Set<google.maps.MapsEventListener>();
    const base = this.register(id, options.layer, {
      setVisible: (visible) => line?.setVisible(visible),
      setZIndex: (zIndex) => line?.setOptions({ zIndex }),
      remove: () => {
        for (const listener of listeners) listener.remove();
        listeners.clear();
        line?.setMap(null);
        line = null;
      },
    });
    return {
      ...base,
      setPath: (path) => line?.setPath(path.map((point) => ({ ...point }))),
      setStyle: (update: MapPolylineStyle) => {
        updatePolylineStyle(style, update);
        applyPolylineStyle(line, style);
      },
      onClick: (callback) => {
        if (!line) return () => undefined;
        line.setOptions({ clickable: true });
        const listener = line.addListener(
          'click',
          (event: google.maps.PolyMouseEvent) => {
            if (!event.latLng) return;
            callback({ lat: event.latLng.lat(), lng: event.latLng.lng() });
          },
        );
        listeners.add(listener);
        return () => {
          listener.remove();
          listeners.delete(listener);
          if (!listeners.size) line?.setOptions({ clickable: false });
        };
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
