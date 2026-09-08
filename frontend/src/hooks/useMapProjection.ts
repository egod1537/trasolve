import { useEffect, useState, type RefObject } from 'react';
import type { MapAdapter } from '../adapters/map/MapAdapter';
import type { MapOverlayHost } from '../adapters/map/MapOverlayHost';
import { expandBounds, isVisible } from '../domain/map/culling';
import type { GeoPoint, ScreenPoint } from '../domain/map/mapTypes';
import type { TripDay, TripPlace, TripRoute } from '../types/trip';

const viewportOverscanRatio = 0.25;

export type ProjectedPlace = {
  place: TripPlace;
  dayTitle: string;
  color: string;
  position: ScreenPoint;
};

export type ProjectedRoute = {
  route: TripRoute;
  points: ScreenPoint[];
};

export type ProjectedMapState = {
  markers: ProjectedPlace[];
  routes: ProjectedRoute[];
};

const emptyProjection: ProjectedMapState = {
  markers: [],
  routes: [],
};

function samePoint(left: ScreenPoint, right: ScreenPoint): boolean {
  return left.x === right.x && left.y === right.y;
}

function sameProjection(
  previous: ProjectedMapState,
  next: ProjectedMapState,
): boolean {
  if (
    previous.markers.length !== next.markers.length ||
    previous.routes.length !== next.routes.length
  ) {
    return false;
  }

  const markersMatch = previous.markers.every((marker, index) => {
    const candidate = next.markers[index];
    return (
      candidate !== undefined &&
      marker.place === candidate.place &&
      marker.dayTitle === candidate.dayTitle &&
      marker.color === candidate.color &&
      samePoint(marker.position, candidate.position)
    );
  });
  if (!markersMatch) return false;

  return previous.routes.every((route, index) => {
    const candidate = next.routes[index];
    return (
      candidate !== undefined &&
      route.route === candidate.route &&
      route.points.length === candidate.points.length &&
      route.points.every((point, pointIndex) => {
        const candidatePoint = candidate.points[pointIndex];
        return candidatePoint !== undefined && samePoint(point, candidatePoint);
      })
    );
  });
}

function projectMap(
  adapter: MapAdapter,
  days: TripDay[],
  routes: TripRoute[],
  project: (point: GeoPoint) => ScreenPoint | null,
): ProjectedMapState {
  const bounds = adapter.getBounds();
  if (!bounds) return emptyProjection;

  const visibleBounds = expandBounds(bounds, viewportOverscanRatio);
  const markers: ProjectedPlace[] = [];

  for (const day of days) {
    for (const place of day.places) {
      if (!isVisible(place, visibleBounds)) continue;
      const position = project(place);
      if (!position) continue;
      markers.push({
        place,
        dayTitle: day.title,
        color: day.color,
        position,
      });
    }
  }

  const projectedRoutes = routes.flatMap((route) => {
    const points = route.path.flatMap((point) => {
      const projectedPoint = project(point);
      return projectedPoint ? [projectedPoint] : [];
    });
    return points.length > 1 ? [{ route, points }] : [];
  });

  return { markers, routes: projectedRoutes };
}

export function useMapProjection(
  adapter: MapAdapter | null,
  overlayHost: MapOverlayHost | null,
  containerRef: RefObject<HTMLElement | null>,
  days: TripDay[],
  routes: TripRoute[],
): ProjectedMapState {
  const [projection, setProjection] =
    useState<ProjectedMapState>(emptyProjection);

  useEffect(() => {
    const container = containerRef.current;
    if (!adapter || !overlayHost || !container) {
      setProjection((current) =>
        current === emptyProjection ? current : emptyProjection,
      );
      return;
    }

    let disposed = false;
    let frame = 0;
    let projectionRevision = -1;
    const projectionCache = new Map<string, ScreenPoint>();
    const project = (point: GeoPoint) => {
      const key = `${point.lat}:${point.lng}`;
      const cached = projectionCache.get(key);
      if (cached) return cached;
      const projectedPoint = overlayHost.project(point);
      // The SDK may not have drawn yet; retry unavailable coordinates later.
      if (projectedPoint) projectionCache.set(key, projectedPoint);
      return projectedPoint;
    };

    const updateProjection = () => {
      frame = 0;
      if (disposed) return;
      const revision = overlayHost.getProjectionRevision();
      if (revision !== projectionRevision) {
        projectionCache.clear();
        projectionRevision = revision;
      }
      const next = projectMap(adapter, days, routes, project);
      setProjection((current) =>
        sameProjection(current, next) ? current : next,
      );
    };
    const scheduleProjectionUpdate = () => {
      if (disposed || frame) return;
      frame = requestAnimationFrame(updateProjection);
    };

    const stopDraw = overlayHost.subscribeDraw(scheduleProjectionUpdate);
    const stopCameraChange = adapter.subscribeCameraChange(
      scheduleProjectionUpdate,
    );
    const resizeObserver = new ResizeObserver(scheduleProjectionUpdate);
    resizeObserver.observe(container);
    scheduleProjectionUpdate();

    return () => {
      disposed = true;
      stopDraw();
      stopCameraChange();
      resizeObserver.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [adapter, overlayHost, containerRef, days, routes]);

  return projection;
}
