import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { loadGoogleMaps, mapsAuthErrorEvent } from '../../maps/googleMaps';
import type { MapPlace } from './types';
import './google-map.css';

type Props = {
  label?: string;
  placeholder?: string;
  className?: string;
  onSelect: (place: MapPlace) => void;
  onError?: (error: Error) => void;
};

export function GooglePlaceSearch({
  label = '장소 검색',
  placeholder = '장소 또는 주소 입력',
  className,
  onSelect,
  onError,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(
    null,
  );
  const callbacks = useRef({ onSelect, onError });
  useLayoutEffect(() => {
    callbacks.current = { onSelect, onError };
  });
  const labelId = useId();
  const [status, setStatus] = useState('검색을 준비하고 있습니다.');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let selection = 0;
    let removeListeners: (() => void) | undefined;
    const fail = (cause: unknown) => {
      if (disposed) return;
      const error = cause instanceof Error ? cause : new Error(String(cause));
      setStatus('');
      setError(error.message);
      callbacks.current.onError?.(error);
    };
    const authFailed = () =>
      fail(new Error('Google Maps 인증에 실패했습니다.'));
    window.addEventListener(mapsAuthErrorEvent, authFailed);
    async function initialize() {
      try {
        await loadGoogleMaps();
        const { PlaceAutocompleteElement } = (await google.maps.importLibrary(
          'places',
        )) as google.maps.PlacesLibrary;
        if (disposed || !containerRef.current) return;
        const widget = new PlaceAutocompleteElement();
        widgetRef.current = widget;
        widget.setAttribute('aria-labelledby', labelId);
        const select = async (event: Event) => {
          const request = ++selection;
          setError(null);
          setStatus('장소 정보를 불러오고 있습니다.');
          try {
            const place = (
              event as google.maps.places.PlacePredictionSelectEvent
            ).placePrediction.toPlace();
            await place.fetchFields({
              fields: ['id', 'displayName', 'formattedAddress', 'location'],
            });
            if (disposed || request !== selection) return;
            if (!place.location)
              throw new Error('이 장소에는 좌표 정보가 없습니다.');
            setStatus('');
            callbacks.current.onSelect({
              id: place.id,
              name:
                place.displayName ?? place.formattedAddress ?? '선택한 장소',
              address: place.formattedAddress ?? undefined,
              location: place.location.toJSON(),
            });
          } catch (error) {
            if (request === selection) fail(error);
          }
        };
        const requestFailed = () =>
          fail(
            new Error(
              '장소 검색에 실패했습니다. Places API 연결을 확인해 주세요.',
            ),
          );
        widget.addEventListener('gmp-select', select);
        widget.addEventListener('gmp-error', requestFailed);
        removeListeners = () => {
          widget.removeEventListener('gmp-select', select);
          widget.removeEventListener('gmp-error', requestFailed);
          widget.remove();
        };
        containerRef.current.append(widget);
        setStatus('');
      } catch (error) {
        fail(error);
      }
    }
    void initialize();
    return () => {
      disposed = true;
      selection++;
      window.removeEventListener(mapsAuthErrorEvent, authFailed);
      removeListeners?.();
      widgetRef.current = null;
    };
  }, [labelId]);

  useEffect(() => {
    if (widgetRef.current) widgetRef.current.placeholder = placeholder;
  }, [placeholder, status]);

  return (
    <div className={`google-place-search ${className ?? ''}`}>
      <span id={labelId}>{label}</span>
      <div ref={containerRef} />
      {status && <span role="status">{status}</span>}
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
