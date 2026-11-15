import {
  placeIdSchema,
  type PlaceDetails,
  type TrouteOptimizeRequest,
} from '@trasolve/shared';
import { useEffect, useState } from 'react';
import { getPlace } from '@/shared/api/places';
import { L } from '@/shared/i18n';

export type RequestLocation = TrouteOptimizeRequest['locations'][number];

export type PlaceLoadState =
  | { key: string; status: 'loading' }
  | { key: string; status: 'loaded'; places: ReadonlyMap<string, PlaceDetails> }
  | { key: string; status: 'error'; message: string };

export function useRequestPlaces(
  locations: readonly RequestLocation[],
): PlaceLoadState {
  const key = locations
    .map((location) => `${location.id}:${location.place_id}`)
    .join('|');
  const invalidLocations = locations.filter(
    (location) => !placeIdSchema.safeParse(location.place_id).success,
  );
  const invalidMessage =
    invalidLocations.length > 0
      ? L(
          'testbed:jobResultMapComparison.useRequestPlaces.text.mapDisplayRequiresValidPlaceId',
          { value: invalidLocations.map((location) => location.id).join(', ') },
        )
      : null;
  const [state, setState] = useState<PlaceLoadState>({
    key,
    status: 'loading',
  });

  useEffect(() => {
    if (invalidMessage) {
      return;
    }

    const controller = new AbortController();
    const placeIds = [
      ...new Set(locations.map((location) => location.place_id)),
    ];
    void Promise.all(
      placeIds.map(
        async (placeId) =>
          [
            placeId,
            await getPlace(placeId, { signal: controller.signal }),
          ] as const,
      ),
    ).then(
      (entries) => {
        if (!controller.signal.aborted) {
          setState({ key, status: 'loaded', places: new Map(entries) });
        }
      },
      (cause: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            key,
            status: 'error',
            message:
              cause instanceof Error
                ? cause.message
                : L(
                    'testbed:jobResultMapComparison.useRequestPlaces.message.failedLoadLocationCoordinates',
                  ),
          });
        }
      },
    );
    return () => controller.abort();
  }, [invalidMessage, key, locations]);

  if (invalidMessage) {
    return { key, status: 'error', message: invalidMessage };
  }
  return state.key === key ? state : { key, status: 'loading' };
}
