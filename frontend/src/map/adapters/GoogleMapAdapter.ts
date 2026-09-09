/// <reference types="google.maps" />

import type { MapAdapter } from './MapAdapter';
import type {
  GeoBounds,
  GeoPoint,
  MapCameraState,
  MapPadding,
  ScreenPoint,
} from '../types/mapTypes';

export class GoogleMapAdapter implements MapAdapter {
  public constructor(map: google.maps.Map) {
    this.map = map;
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
    if (!bounds) return null;
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
    if (!this.map) return;
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

  public subscribeCameraChange(callback: () => void): () => void {
    return this.subscribe('idle', callback);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const remove of [...this.listenerRemovers]) remove();
    this.map = null;
  }

  private readonly listenerRemovers = new Set<() => void>();
  private map: google.maps.Map | null;
  private disposed = false;

  private subscribe(eventName: string, callback: () => void): () => void {
    if (this.disposed || !this.map) return () => undefined;

    const listener = this.map.addListener(eventName, callback);
    let active = true;
    const remove = () => {
      if (!active) return;
      active = false;
      listener.remove();
      this.listenerRemovers.delete(remove);
    };
    this.listenerRemovers.add(remove);
    return remove;
  }
}
