import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { Trip } from '@trasolve/shared';
import type { GeoPoint, MapClickEvent } from '@/shared/types/mapTypes';
import type { Measurement } from '../measurement/useMeasurement';
import type { MapSelectionActions } from './mapViewportTypes';
import {
  initialMapWorkspaceTransientState,
  reduceMapWorkspaceTransientState,
} from './mapWorkspaceStore';

type Options = Pick<
  MapSelectionActions,
  'onSelectPlace' | 'onSelectPolyline' | 'onMapClick'
> & {
  trip: Trip;
  selectionRevision: number;
  measurement?: Pick<Measurement, 'tool' | 'add'>;
  onCloseTripPlace: () => void;
  onCloseTripPolyline: () => void;
};

export function useMapViewportInteractions({
  trip,
  selectionRevision,
  measurement,
  onMapClick,
  onSelectPlace,
  onSelectPolyline,
  onCloseTripPlace,
  onCloseTripPolyline,
}: Options) {
  const preserveSelection = useRef(false);
  const previousRevision = useRef(selectionRevision);
  const [transient, dispatch] = useReducer(
    reduceMapWorkspaceTransientState,
    initialMapWorkspaceTransientState,
  );
  const closeDetails = useCallback(
    () => dispatch({ type: 'detail-closed' }),
    [],
  );
  const handleMapClick = useCallback(
    (event: MapClickEvent) => {
      if (measurement && measurement.tool !== 'pan') {
        measurement.add(event);
        return;
      }
      dispatch({ type: 'map-clicked' });
      onMapClick(event);
    },
    [measurement, onMapClick],
  );
  const selectMapPlace = useCallback(
    (id: string) => {
      if (measurement && measurement.tool !== 'pan') {
        const place = trip.days
          .flatMap((day) => day.places)
          .find((place) => place.id === id);
        if (place) {
          measurement.add(place.location);
        }
        return;
      }
      preserveSelection.current = true;
      dispatch({ type: 'detail-selected', target: { type: 'place', id } });
      onSelectPlace(id);
    },
    [trip, measurement, onSelectPlace],
  );
  const selectMapPolyline = useCallback(
    (id: string, anchor: GeoPoint) => {
      if (measurement && measurement.tool !== 'pan') {
        measurement.add(anchor);
        return;
      }
      preserveSelection.current = true;
      dispatch({ type: 'detail-selected', target: { type: 'polyline', id } });
      onSelectPolyline(id, anchor);
    },
    [measurement, onSelectPolyline],
  );
  const closeTripPlace = useCallback(() => {
    closeDetails();
    onCloseTripPlace();
  }, [closeDetails, onCloseTripPlace]);
  const closeTripPolyline = useCallback(() => {
    closeDetails();
    onCloseTripPolyline();
  }, [closeDetails, onCloseTripPolyline]);
  useEffect(() => {
    if (previousRevision.current === selectionRevision) {
      return;
    }
    previousRevision.current = selectionRevision;
    if (preserveSelection.current) {
      preserveSelection.current = false;
    } else {
      closeDetails();
    }
  }, [closeDetails, selectionRevision]);
  const toggleRouteOptimization = useCallback(
    () => dispatch({ type: 'route-optimization-toggled' }),
    [],
  );
  const closeRouteOptimization = useCallback(
    () => dispatch({ type: 'route-optimization-closed' }),
    [],
  );
  return {
    transient,
    closeDetails,
    handleMapClick,
    selectMapPlace,
    selectMapPolyline,
    closeTripPlace,
    closeTripPolyline,
    toggleRouteOptimization,
    closeRouteOptimization,
  };
}
