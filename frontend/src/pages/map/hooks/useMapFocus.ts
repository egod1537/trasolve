import { useCallback, useMemo, useState } from 'react';
import type { Trip } from '@trasolve/shared';
import type { MapFocus, MapFocusTarget } from '../domain/mapUiTypes';
import { getGeoBounds } from '../domain/geometry';

type MapFocusState = {
  focus: MapFocus;
  target: MapFocusTarget;
};

function createFocusTarget(trip: Trip, focus: MapFocus): MapFocusTarget {
  const focusedDay =
    focus.type === 'day'
      ? trip.days.find((day) => day.id === focus.dayId)
      : undefined;
  const points = (focusedDay ? [focusedDay] : trip.days).flatMap((day) =>
    day.places.map((place) => place.location),
  );
  return {
    type: 'bounds',
    revision: focus.revision,
    bounds: getGeoBounds(points),
  };
}

function createFocusState(trip: Trip, focus: MapFocus): MapFocusState {
  return { focus, target: createFocusTarget(trip, focus) };
}

export function useMapFocus(trip: Trip) {
  // Bounds are snapshots of explicit focus actions; trip edits must not create camera requests.
  const [state, setState] = useState<MapFocusState>(() =>
    createFocusState(trip, { type: 'all', revision: 0 }),
  );
  const { focus, target: focusTarget } = state;

  const focusDay = useCallback(
    (dayId: string) => {
      setState((current) =>
        createFocusState(trip, {
          type: 'day',
          dayId,
          revision: current.focus.revision + 1,
        }),
      );
    },
    [trip],
  );
  const focusAll = useCallback(() => {
    setState((current) =>
      createFocusState(trip, {
        type: 'all',
        revision: current.focus.revision + 1,
      }),
    );
  }, [trip]);
  return useMemo(
    () => ({
      focusTarget,
      revision: focus.revision,
      focusDay,
      focusAll,
    }),
    [focus.revision, focusAll, focusDay, focusTarget],
  );
}
