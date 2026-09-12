import { useEffect, useState } from 'react';
import type { PlaceDetails } from '@trasolve/shared';
import { getPlace } from '../../../api/places';

export type PlaceDetailsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; place: PlaceDetails }
  | { status: 'error' };

export function usePlaceDetails(
  placeId: string | undefined,
): PlaceDetailsState {
  const [settled, setSettled] = useState<
    | { placeId: string; status: 'loaded'; place: PlaceDetails }
    | { placeId: string; status: 'error' }
    | null
  >(null);

  useEffect(() => {
    if (!placeId) return;
    const request = new AbortController();
    void getPlace(placeId, { signal: request.signal }).then(
      (place) => {
        if (!request.signal.aborted)
          setSettled({ placeId, status: 'loaded', place });
      },
      () => {
        if (!request.signal.aborted) setSettled({ placeId, status: 'error' });
      },
    );
    return () => request.abort();
  }, [placeId]);

  if (!placeId) return { status: 'idle' } satisfies PlaceDetailsState;
  if (!settled || settled.placeId !== placeId)
    return { status: 'loading' } satisfies PlaceDetailsState;
  return settled;
}
