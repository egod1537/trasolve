/// <reference types="google.maps" />

import type { GeoPoint, ScreenPoint } from '../../domain/map/mapTypes';
import type { MapOverlayHost } from './MapOverlayHost';

export class GoogleOverlayHost implements MapOverlayHost {
  private readonly element = document.createElement('div');
  private readonly overlay: google.maps.OverlayView;
  private readonly listeners = new Set<() => void>();
  private map: google.maps.Map | null = null;
  private projection: google.maps.MapCanvasProjection | null = null;
  private anchor: google.maps.LatLng | null = null;
  private basis: number[] = [];
  private revision = 0;
  private disposed = false;

  constructor() {
    this.element.className = 'trip-map-overlay-host';
    google.maps.OverlayView.preventMapHitsFrom(this.element);
    // Composition avoids evaluating a Google superclass before the API loads.
    this.overlay = new google.maps.OverlayView();
    this.overlay.onAdd = () => {
      if (!this.disposed) {
        this.overlay.getPanes()?.overlayMouseTarget.append(this.element);
      }
    };
    this.overlay.draw = () => this.draw();
    this.overlay.onRemove = () => {
      this.projection = null;
      this.element.remove();
    };
  }

  attach(map: google.maps.Map): void {
    if (this.disposed || this.map === map) return;
    this.map = map;
    this.projection = null;
    this.anchor = null;
    this.basis = [];
    this.revision += 1;
    this.overlay.setMap(map);
  }

  getElement(): HTMLElement {
    return this.element;
  }

  project(point: GeoPoint): ScreenPoint | null {
    const pixel = this.projection?.fromLatLngToDivPixel(
      new google.maps.LatLng(point.lat, point.lng),
    );
    return pixel ? { x: pixel.x, y: pixel.y } : null;
  }

  getProjectionRevision(): number {
    return this.revision;
  }

  subscribeDraw = (callback: () => void): (() => void) => {
    if (this.disposed) return () => undefined;
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.listeners.clear();
    this.overlay.setMap(null);
    this.element.remove();
    this.projection = null;
    this.map = null;
  }

  private draw(): void {
    if (this.disposed || !this.map) return;
    this.projection = this.overlay.getProjection();
    this.anchor ??= this.map.getCenter() ?? null;
    if (!this.anchor) return;
    const pixel = this.projection.fromLatLngToDivPixel(this.anchor);
    if (!pixel) return;

    // Panning normally translates the pane without changing div pixels.
    // Detect zoom, rotation, tilt, world wrapping and Google's pane rebasing.
    const basis = [
      pixel.x,
      pixel.y,
      this.projection.getWorldWidth(),
      this.map.getZoom() ?? 0,
      this.map.getHeading() ?? 0,
      this.map.getTilt() ?? 0,
    ];
    if (basis.some((value, index) => value !== this.basis[index])) {
      this.basis = basis;
      this.revision += 1;
    }
    for (const listener of this.listeners) listener();
  }
}
