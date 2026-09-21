/// <reference types="google.maps" />

import type { MapAdapter } from '@/map/adapters/MapAdapter';
import { GoogleMapObjectController } from '@/map/adapters/GoogleMapObjectController';
import type { MapObjectController } from '@/map/adapters/MapObjectController';
import type { MapObjectHandle } from '@/shared/map/MapObjectHandle';
import type {
  MapMarkerHandle,
  MapMarkerOptions,
} from '@/shared/map/MapMarkerHandle';
import type {
  MapPolylineHandle,
  MapPolylineOptions,
} from '@/shared/map/MapPolylineHandle';
import type {
  GeoBounds,
  GeoPoint,
  MapCameraState,
  MapEvents,
  MapOptions,
  MapPadding,
  ScreenPoint,
} from '@/shared/types/mapTypes';

export class GoogleMapAdapter implements MapAdapter, MapObjectController {
  public constructor(map: google.maps.Map) {
    this.map = map;
    this.objects = new GoogleMapObjectController(map);
  }

  public getCenter(): GeoPoint | null {
    const center = this.map?.getCenter();
    return center ? { lat: center.lat(), lng: center.lng() } : null;
  }

  public getZoom(): number {
    return this.map?.getZoom() ?? 0;
  }

  public getBounds(): GeoBounds | null {
    const bounds = this.map?.getBounds();
    if (!bounds) {
      return null;
    }
    const northEast = bounds.getNorthEast();
    const southWest = bounds.getSouthWest();
    return {
      north: northEast.lat(),
      south: southWest.lat(),
      east: northEast.lng(),
      west: southWest.lng(),
    };
  }

  public getCamera(): MapCameraState | null {
    const center = this.getCenter();
    return center ? { center, zoom: this.getZoom() } : null;
  }

  public panTo(point: GeoPoint, centerOffset?: ScreenPoint): void {
    if (!this.map) {
      return;
    }
    if (!centerOffset || (!centerOffset.x && !centerOffset.y)) {
      this.map.panTo(point);
      return;
    }

    const projection = this.map.getProjection();
    const worldPoint = projection?.fromLatLngToPoint(
      new google.maps.LatLng(point.lat, point.lng),
    );
    if (!projection || !worldPoint) {
      this.map.panTo(point);
      return;
    }

    const scale = 2 ** this.getZoom();
    const offsetCenter = projection.fromPointToLatLng(
      new google.maps.Point(
        worldPoint.x + centerOffset.x / scale,
        worldPoint.y + centerOffset.y / scale,
      ),
    );
    this.map.panTo(offsetCenter ?? point);
  }

  public setZoom(zoom: number): void {
    this.map?.setZoom(zoom);
  }

  public fitBounds(bounds: GeoBounds, padding?: MapPadding): void {
    this.map?.fitBounds(
      {
        north: bounds.north,
        south: bounds.south,
        east: bounds.east,
        west: bounds.west,
      },
      padding,
    );
  }

  public resize(): void {
    if (!this.map) {
      return;
    }
    const center = this.map.getCenter();
    google.maps.event.trigger(this.map, 'resize');
    if (center) {
      this.map.setCenter(center);
    }
  }

  public setOptions(options: MapOptions): void {
    this.map?.setOptions(options);
  }

  public subscribeEvents(events: MapEvents): () => void {
    if (this.disposed || !this.map) {
      return () => undefined;
    }
    const map = this.map;
    const listeners = [
      map.addListener(
        'click',
        (event: google.maps.MapMouseEvent | google.maps.IconMouseEvent) => {
          const placeId = 'placeId' in event ? event.placeId : null;
          if (placeId) {
            event.stop();
          }
          if (!event.latLng) {
            return;
          }
          const point = event.latLng.toJSON();
          events.onMapClick?.(placeId ? { ...point, placeId } : point);
        },
      ),
      map.addListener('center_changed', () => {
        const center = this.getCenter();
        if (center) {
          events.onCenterChanged?.(center);
        }
      }),
      map.addListener('zoom_changed', () => {
        events.onZoomChanged?.(this.getZoom());
      }),
    ];
    let active = true;
    const remove = () => {
      if (!active) {
        return;
      }
      active = false;
      for (const listener of listeners) {
        listener.remove();
      }
      this.listenerRemovers.delete(remove);
    };
    this.listenerRemovers.add(remove);
    return remove;
  }

  public addMarker(options: MapMarkerOptions): MapMarkerHandle {
    return this.objects.addMarker(options);
  }

  public addPolyline(options: MapPolylineOptions): MapPolylineHandle {
    return this.objects.addPolyline(options);
  }

  public remove(object: MapObjectHandle): void {
    this.objects.remove(object);
  }

  public clearLayer(layer: string): void {
    this.objects.clearLayer(layer);
  }

  public clear(): void {
    this.objects.clear();
  }

  public subscribeCameraChange(callback: () => void): () => void {
    return this.subscribe('idle', callback);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const remove of [...this.listenerRemovers]) {
      remove();
    }
    this.objects.dispose();
    this.map = null;
  }

  private readonly listenerRemovers = new Set<() => void>();
  private readonly objects: GoogleMapObjectController;
  private map: google.maps.Map | null;
  private disposed = false;

  private subscribe(eventName: string, callback: () => void): () => void {
    if (this.disposed || !this.map) {
      return () => undefined;
    }

    const listener = this.map.addListener(eventName, callback);
    let active = true;
    const remove = () => {
      if (!active) {
        return;
      }
      active = false;
      listener.remove();
      this.listenerRemovers.delete(remove);
    };
    this.listenerRemovers.add(remove);
    return remove;
  }
}
