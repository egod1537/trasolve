import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ApiStatus, Endpoint } from '../components/google-maps-test/types';
import {
  getDirections,
  type DirectionsRequest,
  type DirectionsResult,
  type TravelMode,
} from '../maps/googleDirections';

export function useDirectionsState(appendLog: (message: string) => void) {
  const requestId = useRef(0);
  const [origin, setOrigin] = useState<Endpoint>({ text: '東京駅、日本' });
  const [destination, setDestination] = useState<Endpoint>({
    text: '東京タワー、日本',
  });
  const [travelMode, setTravelMode] = useState<TravelMode>('DRIVING');
  const [alternatives, setAlternatives] = useState(false);
  const [apiStatus, setApiStatus] = useState<ApiStatus>('idle');
  const [request, setRequest] = useState<DirectionsRequest | null>(null);
  const [result, setResult] = useState<DirectionsResult | null>(null);
  const [routeIndex, setRouteIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pending = apiStatus === 'loading';
  const route = result?.routes[routeIndex];
  const polylines = useMemo(
    () => (route ? [{ path: route.path }] : []),
    [route],
  );

  useEffect(
    () => () => {
      requestId.current++;
    },
    [],
  );

  const changeOrigin = useCallback((text: string) => setOrigin({ text }), []);
  const changeDestination = useCallback(
    (text: string) => setDestination({ text }),
    [],
  );
  const findRoute = useCallback(async () => {
    if (pending) return;
    const id = ++requestId.current;
    const nextRequest: DirectionsRequest = {
      origin: origin.location ?? origin.text.trim(),
      destination: destination.location ?? destination.text.trim(),
      travelMode,
      computeAlternativeRoutes: alternatives,
    };
    setRequest(nextRequest);
    setApiStatus('loading');
    setError(null);
    setResult(null);
    setRouteIndex(0);
    appendLog('길찾기 요청');
    try {
      const response = await getDirections(nextRequest);
      if (id !== requestId.current) return;
      setResult(response);
      setApiStatus('success');
      appendLog(`길찾기 응답: ${response.routes.length}개 경로`);
    } catch (cause) {
      if (id !== requestId.current) return;
      const message =
        cause instanceof Error
          ? `${cause.name}: ${cause.message}`
          : String(cause);
      setError(message);
      setApiStatus('error');
      appendLog(`길찾기 실패: ${message}`);
    }
  }, [pending, origin, destination, travelMode, alternatives, appendLog]);

  return {
    origin,
    destination,
    travelMode,
    alternatives,
    pending,
    apiStatus,
    request,
    result,
    routeIndex,
    route,
    polylines,
    error,
    setOrigin,
    setDestination,
    setTravelMode,
    setAlternatives,
    setRouteIndex,
    changeOrigin,
    changeDestination,
    findRoute,
  };
}
