import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PlaceDetails } from '@trasolve/shared';
import { getPlace } from '../../../api/places';
import type { GeoPoint } from '../../../map/types/mapTypes';
import type { SelectedGooglePlace } from '../domain/selectedGooglePlace';

export function useSelectedGooglePlace() {
  const [selection, setSelection] = useState<SelectedGooglePlace>(null);
  const activeRequest = useRef<AbortController | null>(null);

  const close = useCallback(() => {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setSelection(null);
  }, []);

  const select = useCallback((placeId: string, clickedLocation: GeoPoint) => {
    activeRequest.current?.abort();
    const request = new AbortController();
    activeRequest.current = request;
    setSelection({ status: 'loading', placeId, clickedLocation });

    void getPlace(placeId, { signal: request.signal }).then(
      (place) => {
        if (request.signal.aborted || activeRequest.current !== request) {
          return;
        }
        activeRequest.current = null;
        setSelection({
          status: 'loaded',
          placeId,
          clickedLocation,
          place,
        });
      },
      () => {
        if (request.signal.aborted || activeRequest.current !== request) {
          return;
        }
        activeRequest.current = null;
        setSelection({ status: 'error', placeId, clickedLocation });
      },
    );
  }, []);

  const show = useCallback((place: PlaceDetails) => {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setSelection({
      status: 'loaded',
      placeId: place.id,
      clickedLocation: place.location,
      place,
    });
  }, []);

  useEffect(
    () => () => {
      activeRequest.current?.abort();
      activeRequest.current = null;
    },
    [],
  );

  return useMemo(
    () => ({ selection, select, show, close }),
    [close, select, selection, show],
  );
}
